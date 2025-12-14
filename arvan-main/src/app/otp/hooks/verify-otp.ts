/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiClient } from "@/lib/axiosClient";
import { useMutation } from "@tanstack/react-query";

const verifyOtp = async(data:any)=>{
   const response = await apiClient.post("/api/customers/verify-otp",data);
   // Store JWT in localStorage if present
   if (response.data && response.data.jwt) {
     localStorage.setItem('authToken', response.data.jwt);
   }
   return response.data;
}

const resendOtp = async(data:any)=>{
    return  (await apiClient.post(`/api/customers/resend-otp`,data)).data;
}

export const useVerifyOtp = () => {
    return useMutation({
        mutationFn:verifyOtp,
        mutationKey:[ "verify-otp"]
        
    })
}

export const useResendOtp = () => {
    return useMutation({
        mutationFn:resendOtp,
        mutationKey:[ "resend-otp"]
    })
};
