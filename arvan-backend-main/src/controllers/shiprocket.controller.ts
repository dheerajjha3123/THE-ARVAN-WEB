import { NextFunction, Request, Response, RequestHandler } from "express";
import { prisma } from "../utils/prismaclient.js";
import { RouteError } from "../common/routeerror.js";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { ShipRocketOrderSchema } from "../types/validations/shipRocket.js";
import axios from "axios";
import { OrderFulfillment } from "@prisma/client";

const getShiprocketToken = async () => {
    // Always fetch a new token to ensure validity
    const email = process.env.SHIPROCKET_EMAIL?.trim();
    const password = process.env.SHIPROCKET_PASSWORD?.trim();

    if (!email || !password) {
        console.error("Shiprocket credentials not found in environment variables");
        return null;
    }

    try {
        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/auth/login",
            { email, password },
            {
                headers: { "Content-Type": "application/json" },
            }
        );

        const token = response.data.token;
        if (token) {
            await prisma.$transaction([
                prisma.shiprocketToken.deleteMany(),
                prisma.shiprocketToken.create({ data: { token } }),
            ]);
        }
        return token;
    } catch (error: any) {
        console.error("Shiprocket Auth Error:", error?.response?.status || error.message);
        console.error("Auth Error Details:", error?.response?.data?.message || "Unknown error");
        return null;
    }
};

// Format phone number for Shiprocket (must be 10 digits for Indian numbers)
const formatPhoneForShiprocket = (phone: string): string | null => {
    console.log(`formatPhoneForShiprocket: Processing phone "${phone}"`);

    if (!phone || phone === "0000000000") {
        console.log(`formatPhoneForShiprocket: Phone is null/empty or dummy number`);
        return null;
    }

    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    console.log(`formatPhoneForShiprocket: Digits only "${digitsOnly}", length: ${digitsOnly.length}`);

    // Check if it's a valid Indian mobile number (10 digits, starting with 6-9)
    if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
        console.log(`formatPhoneForShiprocket: Valid 10-digit number starting with 6-9`);
        return digitsOnly;
    }

    // If it's 12 digits starting with 91 (country code), extract last 10
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        const last10 = digitsOnly.slice(-10);
        if (/^[6-9]/.test(last10)) {
            console.log(`formatPhoneForShiprocket: Valid 12-digit number with country code`);
            return last10;
        }
    }

    // If it's 13 digits starting with +91, extract last 10
    if (digitsOnly.length === 13 && digitsOnly.startsWith('091')) {
        const last10 = digitsOnly.slice(-10);
        if (/^[6-9]/.test(last10)) {
            console.log(`formatPhoneForShiprocket: Valid 13-digit number with +91`);
            return last10;
        }
    }

    console.log(`formatPhoneForShiprocket: Invalid phone number "${phone}" for order - returning null`);
    return null;
};

const createShiprocketOrder: RequestHandler = async (req, res, next) => {
    const orderData = req.body;

    // Input validation
    if (!orderData || typeof orderData !== 'object') {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid request body");
    }

    if (!orderData.order_id || typeof orderData.order_id !== 'string') {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "order_id is required and must be a string");
    }

    if (!orderData.order_items || !Array.isArray(orderData.order_items) || orderData.order_items.length === 0) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "order_items must be a non-empty array");
    }

    // Fetch phone from user's saved addresses if phone is missing/dummy
    console.log(`Address ID: ${orderData.address_id}`);
    console.log(`Phone fields before address fetch: billing_phone="${orderData.billing_phone}", customer_phone="${orderData.customer_phone}", phone="${orderData.phone}"`);
    console.log(`Address fields before fetch: billing_customer_name="${orderData.billing_customer_name}", billing_address="${orderData.billing_address}", billing_city="${orderData.billing_city}", billing_state="${orderData.billing_state}", billing_pincode="${orderData.billing_pincode}"`);

    // Check if phone is missing or dummy
    const phoneIsDummy = orderData.billing_phone === "0000000000" || orderData.billing_phone === "null" || !orderData.billing_phone;
    console.log(`Phone is dummy/missing: ${phoneIsDummy}`);

    if (phoneIsDummy && orderData.user_id) {
        console.log("Phone is dummy/missing, fetching from user's saved addresses...");
        try {
            // Find user's addresses that match the billing address data
            const userAddresses = await prisma.address.findMany({
                where: { userId: orderData.user_id }
            });
            console.log(`Found ${userAddresses.length} addresses for user ${orderData.user_id}`);

            // Try to match by address components
            let matchingAddress = null;

            for (const addr of userAddresses) {
                console.log(`Checking address: ${addr.street}, ${addr.city}, ${addr.zipCode} - Phone: ${addr.phone}`);

                // Match by street and city, or by full address components
                const addressMatch =
                    (addr.street === orderData.billing_address?.split(',')[0]?.trim()) ||
                    (addr.city === orderData.billing_city && addr.zipCode === orderData.billing_pincode);

                if (addressMatch && addr.phone && addr.phone !== "0000000000") {
                    matchingAddress = addr;
                    console.log(`✅ Found matching address with phone: ${addr.phone}`);
                    break;
                }
            }

            if (matchingAddress) {
                orderData.billing_phone = matchingAddress.phone;
                console.log(`✅ Set billing_phone from matching address: ${matchingAddress.phone}`);

                // Also populate other missing fields if needed
                if (!orderData.billing_customer_name || orderData.billing_customer_name === "null" || orderData.billing_customer_name === "") {
                    orderData.billing_customer_name = matchingAddress.name;
                    console.log(`Set billing_customer_name from address: ${matchingAddress.name}`);
                }
            } else {
                console.log(`❌ No matching address found with valid phone number`);
            }
        } catch (error) {
            console.warn("Failed to fetch phone from user addresses:", error);
        }
    } else if (orderData.address_id) {
        console.log("Address_id provided, fetching complete address data...");
        try {
            const address = await prisma.address.findUnique({
                where: { id: orderData.address_id }
            });
            console.log(`Address fetched:`, address);

            if (address) {
                console.log(`Address phone field: "${address.phone}" (type: ${typeof address.phone})`);

                // Populate phone if missing
                const phoneMissing = (!orderData.billing_phone || orderData.billing_phone === "null" || orderData.billing_phone === "") &&
                    (!orderData.customer_phone || orderData.customer_phone === "null" || orderData.customer_phone === "") &&
                    (!orderData.phone || orderData.phone === "null" || orderData.phone === "");

                console.log(`Phone missing condition: ${phoneMissing}`);
                console.log(`Address phone valid: ${address.phone && address.phone !== "0000000000"}`);

                if (phoneMissing && address.phone && address.phone !== "0000000000") {
                    orderData.billing_phone = address.phone;
                    console.log(`✅ Set billing_phone from address: ${address.phone}`);
                } else {
                    console.log(`❌ Phone not set from address. Missing: ${phoneMissing}, Address phone: "${address.phone}"`);
                }

                // Populate customer name if missing
                if (!orderData.billing_customer_name || orderData.billing_customer_name === "null" || orderData.billing_customer_name === "") {
                    orderData.billing_customer_name = address.name;
                    console.log(`Set billing_customer_name from address: ${address.name}`);
                }

                // Populate address if missing
                if (!orderData.billing_address || orderData.billing_address === "null" || orderData.billing_address === "") {
                    orderData.billing_address = address.street;
                    console.log(`Set billing_address from address: ${address.street}`);
                }

                // Populate city if missing
                if (!orderData.billing_city || orderData.billing_city === "null" || orderData.billing_city === "") {
                    orderData.billing_city = address.city;
                    console.log(`Set billing_city from address: ${address.city}`);
                }

                // Populate state if missing
                if (!orderData.billing_state || orderData.billing_state === "null" || orderData.billing_state === "") {
                    orderData.billing_state = address.state;
                    console.log(`Set billing_state from address: ${address.state}`);
                }

                // Populate pincode if missing
                if (!orderData.billing_pincode || orderData.billing_pincode === "null" || orderData.billing_pincode === "") {
                    orderData.billing_pincode = address.zipCode;
                    console.log(`Set billing_pincode from address: ${address.zipCode}`);
                }

                console.log("Address data populated successfully");
            } else {
                console.log(`Address not found for ID: ${orderData.address_id}`);
            }
        } catch (error) {
            console.warn("Failed to fetch address data:", error);
        }
    } else {
        console.log("No address_id provided and phone is not dummy - skipping address data fetch");
    }

    console.log(`Phone fields after address fetch: billing_phone="${orderData.billing_phone}", customer_phone="${orderData.customer_phone}", phone="${orderData.phone}"`);
    console.log(`Address fields after fetch: billing_customer_name="${orderData.billing_customer_name}", billing_address="${orderData.billing_address}", billing_city="${orderData.billing_city}", billing_state="${orderData.billing_state}", billing_pincode="${orderData.billing_pincode}"`);

    // Remove dummy phone numbers and handle string "null" values
    console.log(`Before dummy phone removal: billing_phone="${orderData.billing_phone}", customer_phone="${orderData.customer_phone}", phone="${orderData.phone}"`);

    // Convert string "null" to actual null
    if (orderData.billing_phone === "null") orderData.billing_phone = null;
    if (orderData.customer_phone === "null") orderData.customer_phone = null;
    if (orderData.phone === "null") orderData.phone = null;

    // Remove dummy phone numbers
    if (orderData.billing_phone === "0000000000") orderData.billing_phone = null;
    if (orderData.customer_phone === "0000000000") orderData.customer_phone = null;
    if (orderData.phone === "0000000000") orderData.phone = null;

    console.log(`After dummy phone removal: billing_phone="${orderData.billing_phone}", customer_phone="${orderData.customer_phone}", phone="${orderData.phone}"`);

    const shipToken = await getShiprocketToken();

    if (!shipToken) {
        // Don't throw error - save order to DB but return warning about Shiprocket
        console.warn("Shiprocket authentication failed - order will be saved locally only");

        // Still save the order to database
        try {
            // Check if order already exists
            const existingOrder = await prisma.order.findUnique({
                where: { id: orderData.order_id }
            });

            if (existingOrder) {
                res.status(HttpStatusCodes.OK).json({
                    success: true,
                    message: "Order already exists and was saved previously.",
                    shiprocket_status: "skipped",
                    order_id: orderData.order_id
                });
                return;
            }

            await prisma.order.create({
                data: {
                    id: orderData.order_id,
                    userId: orderData.user_id || orderData.customer_id, // Use userId field from schema
                    total: orderData.sub_total,
                    paid: orderData.payment_method !== 'COD',
                    status: 'PENDING',
                    fulfillment: 'PENDING',
                    addressId: orderData.address_id, // Required address relation
                    items: {
                        create: orderData.order_items.map((item: any) => ({
                            productName: item.name,
                            color: item.sku.split('ARV')[1]?.charAt(0) || 'Default',
                            size: item.sku.split('ARV')[1]?.slice(1) || 'Default',
                            quantity: item.units,
                            priceAtOrder: parseFloat(item.selling_price) || 0,
                            productId: item.product_id || 'default-product-id', // Required product relation
                            productVariantId: item.variant_id || 'default-variant-id', // Required variant relation
                            productImage: item.product_image || item.productImage || 'default-image-url'
                        }))
                    }
                }
            });

            res.status(HttpStatusCodes.CREATED).json({
                success: true,
                message: "Order saved successfully, but Shiprocket integration failed. Please check your Shiprocket credentials.",
                shiprocket_status: "failed",
                order_id: orderData.order_id
            });
            return;
        } catch (dbError: any) {
            console.error("Database error:", dbError);
            throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Failed to save order");
        }
    }

    // Clean the billing address to remove pincode if present at the end
    if (orderData.billing_address && orderData.billing_pincode) {
        const pincodePattern = new RegExp(`\\s*-\\s*${orderData.billing_pincode}\\s*$`);
        orderData.billing_address = orderData.billing_address.replace(pincodePattern, '').trim();
    }

    // Try to fetch valid pickup locations, fallback to default if fails
    try {
        const locationsResponse = await axios.get(
            "https://apiv2.shiprocket.in/v1/external/settings/company/pickup",
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${shipToken}`,
                }
            }
        );
        const locations = locationsResponse.data.shipping_address || locationsResponse.data.data;
        console.log("Available pickup locations:", locations);
        console.log("Locations type:", typeof locations, "Is array:", Array.isArray(locations));

        // Handle both cases: locations is the array directly, or locations is the full response object
        let pickupLocations = [];
        if (Array.isArray(locations)) {
            pickupLocations = locations;
        } else if (locations && locations.shipping_address && Array.isArray(locations.shipping_address)) {
            pickupLocations = locations.shipping_address;
        }

        if (pickupLocations.length > 0) {
            // Use the first available pickup location
            const firstLocation = pickupLocations[0];
            orderData.pickup_location = firstLocation.pickup_location || firstLocation.nickname || firstLocation.address || firstLocation.city;
            console.log("Selected pickup location:", orderData.pickup_location);
        } else {
            console.warn("No pickup locations found in response - locations:", locations);
            // Set a default pickup location if none found
            orderData.pickup_location = "warehouse"; // Use the first location name we saw in logs
        }
    } catch (error: any) {
        console.warn("Failed to fetch pickup locations:", error?.response?.status || error.message);
        console.warn("Pickup location error details:", error?.response?.data);

        // If we get the "Wrong Pickup location" error, it means locations exist but we're using wrong name
        // In this case, we should not set any pickup_location and let the API handle it
        if (error?.response?.data?.message?.includes("Wrong Pickup location")) {
            console.log("Pickup location validation failed, removing pickup_location from order");
            delete orderData.pickup_location;
        } else {
            // For other errors, don't set pickup location
            delete orderData.pickup_location;
        }
    }

    console.log(orderData);

    console.log(`About to call formatPhoneForShiprocket with: billing_phone="${orderData.billing_phone}", customer_phone="${orderData.customer_phone}", phone="${orderData.phone}"`);
    console.log(`Phone field types: billing_phone=${typeof orderData.billing_phone}, customer_phone=${typeof orderData.customer_phone}, phone=${typeof orderData.phone}`);

    const phoneToValidate = orderData.billing_phone || orderData.customer_phone || orderData.phone || "";
    console.log(`Phone to validate: "${phoneToValidate}" (type: ${typeof phoneToValidate})`);

    const billingPhone = formatPhoneForShiprocket(phoneToValidate);

    if (!billingPhone) {
      // Invalid phone number - save order locally without Shiprocket
      console.warn("Invalid phone number for Shiprocket - order will be saved locally only");

      try {
        // Check if order already exists
        const existingOrder = await prisma.order.findUnique({
          where: { id: orderData.order_id }
        });

        if (existingOrder) {
          res.status(HttpStatusCodes.OK).json({
            success: true,
            message: "Order already exists and was saved previously.",
            shiprocket_status: "skipped",
            order_id: orderData.order_id
          });
          return;
        }

        await prisma.order.create({
          data: {
            id: orderData.order_id,
            userId: orderData.user_id || orderData.customer_id,
            total: orderData.sub_total,
            paid: orderData.payment_method !== 'COD',
            status: 'PENDING',
            fulfillment: 'PENDING',
            addressId: orderData.address_id,
            items: {
              create: orderData.order_items.map((item: any) => ({
                productName: item.name,
                color: item.sku.split('ARV')[1]?.charAt(0) || 'Default',
                size: item.sku.split('ARV')[1]?.slice(1) || 'Default',
                quantity: item.units,
                priceAtOrder: parseFloat(item.selling_price) || 0,
                productId: item.product_id || 'default-product-id',
                productVariantId: item.variant_id || 'default-variant-id',
                productImage: item.product_image || item.productImage || 'default-image-url'
              }))
            }
          }
        });

        res.status(HttpStatusCodes.CREATED).json({
          success: true,
          message: "Order saved successfully, but Shiprocket integration failed due to invalid phone number.",
          shiprocket_status: "failed",
          order_id: orderData.order_id
        });
        return;
      } catch (dbError: any) {
        console.error("Database error:", dbError);
        throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Failed to save order");
      }
    }

    orderData.billing_phone = billingPhone;



    // Add default values for required fields that might be missing
    const enrichedOrderData = {
        ...orderData,
        billing_customer_name:
     orderData.billing_customer_name || orderData.customer_name || "Customer",
    billing_address:
    orderData.billing_address || orderData.shipping_address || "Address",
  billing_city:
    orderData.billing_city || orderData.shipping_city || "City",
  billing_pincode:
    orderData.billing_pincode || orderData.shipping_pincode || "000000",
  billing_state:
    orderData.billing_state || orderData.shipping_state || "State",
  billing_country: "India",
  billing_email:
    orderData.billing_email || orderData.customer_email || "customer@example.com",
  billing_phone: billingPhone,

        order_items: orderData.order_items.map((item: any) => ({
            ...item,
            hsn: item.hsn || "0000" // Add default HSN code if missing
        }))
    };

    const passedData = ShipRocketOrderSchema.safeParse(enrichedOrderData);
    if (!passedData.success) {
        console.error("Validation errors:", passedData.error.errors);
        console.error("Order data being validated:", enrichedOrderData);
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid data: " + passedData.error.errors.map(e => e.message).join(", "));
    }

    // Ensure unique SKUs for Shiprocket order items
    const uniqueSkus = new Set<string>();
    orderData.order_items = orderData.order_items.map((item: any, index: number) => {
        let sku = item.sku;
        let counter = 1;
        while (uniqueSkus.has(sku)) {
            sku = `${item.sku}_${counter}`;
            counter++;
        }
        uniqueSkus.add(sku);
        return { ...item, sku };
    });

    

    // ====================
    // ✅ SANITIZE NAME
    // ====================
    const fullName =
      orderData.billing_customer_name ||
      orderData.customer_name ||
      "Customer";

    const nameParts = fullName.trim().split(" ");
    const billingCustomerName = nameParts[0];
    const billingLastName = nameParts.slice(1).join(" ") || "";

    // ====================
    // ✅ FINAL SHIPROCKET PAYLOAD
    // ====================
    const shiprocketPayload = {
      order_id: orderData.order_id,
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: orderData.pickup_location || "warehouse",

      billing_customer_name: billingCustomerName,
    //   billing_last_name: billingLastName,
      billing_address: orderData.billing_address,
      billing_city: orderData.billing_city,
      billing_pincode: orderData.billing_pincode,
      billing_state: orderData.billing_state,
      billing_country: "India",
      billing_email: orderData.billing_email || "test@test.com",
      billing_phone: billingPhone,
      billing_last_name: billingLastName,

      shipping_is_billing: true,

      order_items: orderData.order_items.map((item: any) => ({
        name: item.name,
        sku: item.sku,
        units: item.units,
        selling_price: String(item.selling_price),
        hsn: item.hsn || "0000",
      })),

      payment_method: orderData.payment_method || "COD",
      sub_total: orderData.sub_total,

      length: orderData.length || 10,
      breadth: orderData.breadth || 10,
      height: orderData.height || 10,
      weight: orderData.weight || 1,
    };

    try {
        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
            shiprocketPayload,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${shipToken}`,
                }
            }
        );
        console.log(response.data);

        const ShipRocketOrderId = response.data.order_id;
        await prisma.$transaction([
            prisma.order.update({
                where: {
                    id: orderData.order_id
                },
                data: {
                    ShipRocketOrderId: ShipRocketOrderId
                }
            })
        ]);

        res.status(HttpStatusCodes.CREATED).json({ success: true, data: response.data });

    } catch (error: any) {
        console.error("Shiprocket Create Order Error:", error);

        // Handle specific Shiprocket errors
        if (error.response?.status === 400) {
            const errorMessage = error.response?.data?.message || "Bad request to Shiprocket";
            console.error("Shiprocket 400 Error:", errorMessage);

            // If it's about pickup location or address, provide helpful guidance
            if (errorMessage.includes("billing/shipping address") || errorMessage.includes("pickup")) {
                res.status(HttpStatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: "Shiprocket Configuration Required",
                    message: "Please configure your pickup location and billing/shipping address in your Shiprocket dashboard first.",
                    details: errorMessage
                });
                return;
            }

            res.status(HttpStatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Order Creation Failed",
                message: errorMessage
            });
            return;
        }

        // For other errors, still save the order but mark it as failed
        res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to create Shiprocket order",
            message: error.response?.data?.message || error.message
        });
    }

};

const cancelShiprocketOrder: RequestHandler = async (req, res, next) => {
    const shipToken = await getShiprocketToken();
    if (!shipToken) {
        throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const orderId = req.body.orderId;

    try {

        const orderData = await prisma.order.findUnique({
            where: {
                id: orderId
            }
        });

        console.log(orderData);

        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/orders/cancel",
            { ids: [orderData?.ShipRocketOrderId] },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${shipToken}`,
                }
            }
        );

        console.log(response.data);

        // Update the order status to CANCELLED in the database
        await prisma.order.update({
            where: {
                id: orderId
            },
            data: {
                status: 'CANCELLED'
            }
        });

        res.status(HttpStatusCodes.CREATED).json({ success: true, data: response.data });
    } catch (error) {
        console.error("Shiprocket Cancel Order Error:", error);
    }
};


const returnShiprocketOrder: RequestHandler = async (req, res, next) => {
    const shipToken = await getShiprocketToken();
    if (!shipToken) {
        throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const orderId = req.body.orderId;
    const reason = req.body.reason;
    const additionalInfo = req.body.additionalInfo;

    const order = await prisma.order.findUnique({
        where: {
            id: orderId
        },
        include: {
            items: true
        }
    });

    const getOrderDetails = await axios.get(`https://apiv2.shiprocket.in/v1/external/orders/show/` + order?.ShipRocketOrderId, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${shipToken}`,
        }
    })


    const oData = getOrderDetails.data;
    const orderData = {
        "order_id": oData.data.id,
        "order_date": order?.createdAt.toISOString().split('T')[0],
        "pickup_customer_name": oData.data.customer_name, 
        "pickup_address": oData.data.customer_address,
        "pickup_city": oData.data.customer_city,
        "pickup_state": oData.data.customer_state,
        "pickup_country": oData.data.customer_country,
        "pickup_pincode": oData.data.customer_pincode,
        "pickup_email": oData.data.customer_email,
        "pickup_phone": oData.data.customer_phone,
        "shipping_customer_name": "Kartik ",
        "shipping_address": oData.data.pickup_location,
        "shipping_city": "Gautam Buddha Nagar",
        "shipping_country": "India",
        "shipping_pincode": "201301",
        "shipping_state": "Uttar Pradesh",
        "shipping_phone": "7428637234",
        "order_items": order?.items.map((item) => ({
            "name": item.productName,
            "sku": "ARV" + item.color + item.size,
            "units": item.quantity,
            "selling_price": item.priceAtOrder
        })),
        "payment_method": order?.paid ? "cod" : "Prepaid",
        "sub_total": order?.total,
        "length": oData.data.shipments.length,
        "breadth": oData.data.shipments.breadth,
        "height": oData.data.shipments.height,
        "weight": oData.data.shipments.weight,
    };
    console.log(orderData);
    try {
        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/orders/create/return",
            orderData,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${shipToken}`,
                }
            }
        );
        console.log(response.data);

        await prisma.order.update({
            where: {
                id: orderId
            },
            data: {
                returnReason: reason,
                returnAdditionalInfo: additionalInfo,
                fulfillment: OrderFulfillment.RETURNING,
            }
        });

        res.status(HttpStatusCodes.CREATED).json({ success: true, data: response.data });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Shiprocket Return Order Error:", {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });

            console.error("Shiprocket Return Order Error:", error.response?.data.errors);
            res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: error.response?.data?.message || error.message || "Failed to return order"
            });
        } else {
            console.error("Shiprocket Return Order Error:", error);
            res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: "Failed to return order"
            });
        }
    }
};

const getShiprocketPickupLocations: RequestHandler = async (req, res, next) => {
    const shipToken = await getShiprocketToken();
    if (!shipToken) {
        throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }
    try {
        const response = await axios.get(
            "https://apiv2.shiprocket.in/v1/external/settings/company/pickup",
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${shipToken}`,
                }
            }
        );
        res.status(HttpStatusCodes.OK).json({ success: true, locations: response.data.data });
    } catch (error: any) {
        console.error("Shiprocket Pickup Locations Fetch Error:", error?.response?.status || error.message);
        res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to fetch pickup locations",
            details: error?.response?.data?.message || error.message
        });
    }
};

export default {
    createShiprocketOrder,
    cancelShiprocketOrder,
    returnShiprocketOrder,
    getShiprocketPickupLocations
};