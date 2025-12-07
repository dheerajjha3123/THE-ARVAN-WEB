import React from "react";
import Image from "next/image";

const BentoImg = () => {
  // Using optimized individual images instead of one large image
  const images = [
    "https://res.cloudinary.com/dficko9l8/image/upload/w_400,h_400,c_crop,g_north_west,x_0,y_0/v1743685583/Desktop_tds6fg.png",
    "https://res.cloudinary.com/dficko9l8/image/upload/w_400,h_800,c_crop,g_north_east,x_0,y_0/v1743685583/Desktop_tds6fg.png",
    "https://res.cloudinary.com/dficko9l8/image/upload/w_400,h_400,c_crop,g_center/v1743685583/Desktop_tds6fg.png",
    "https://res.cloudinary.com/dficko9l8/image/upload/w_400,h_400,c_crop,g_south_west,x_0,y_0/v1743685583/Desktop_tds6fg.png",
    "https://res.cloudinary.com/dficko9l8/image/upload/w_400,h_400,c_crop,g_south_east,x_0,y_0/v1743685583/Desktop_tds6fg.png",
  ];

  return (
    <div className="relative w-full max-w-xl hidden lg:grid grid-cols-2 gap-2">
      {/* Top-left large cell */}
      <div className="relative overflow-hidden rounded-lg border-2 border-lime-500">
        <Image
          src={images[0]}
          alt="Product showcase top left"
          fill
          loading="lazy"
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Top-right large cell (spans 2 rows) */}
      <div className="relative overflow-hidden rounded-lg border-2 border-lime-500 row-span-2">
        <Image
          src={images[1]}
          alt="Product showcase top right"
          fill
          loading="lazy"
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Middle-left small cell */}
      <div className="relative overflow-hidden rounded-lg border-2 border-lime-500">
        <Image
          src={images[2]}
          alt="Product showcase middle left"
          fill
          loading="lazy"
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Bottom-left large cell */}
      <div className="relative overflow-hidden rounded-lg border-2 border-lime-500">
        <Image
          src={images[3]}
          alt="Product showcase bottom left"
          fill
          loading="lazy"
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Bottom-right large cell */}
      <div className="relative overflow-hidden rounded-lg border-2 border-lime-500">
        <Image
          src={images[4]}
          alt="Product showcase bottom right"
          fill
          loading="lazy"
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
    </div>
  );
};

export default BentoImg;
