// lib/mailer.ts
import nodemailer from "nodemailer";

// Configure your Nodemailer transporter
// Use environment variables for production
export const transporter = nodemailer.createTransport({
  service: "gmail", // You can use other services or direct SMTP
  auth: {
    user: process.env.EMAIL_SERVER_USER, // Your email address
    pass: process.env.EMAIL_SERVER_PASSWORD, // Your email password or app-specific password
  },
});

export async function sendOtp(email: string, otp: string) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, // Sender email address
      to: email, // Recipient email address
      subject: "Your OTP Code for Login",
      text: `Your One-Time Password (OTP) is: ${otp}. It is valid for 5 minutes. Please do not share this code with anyone.`,
      html: `<p>Your One-Time Password (OTP) is: <strong>${otp}</strong>.</p><p>It is valid for 5 minutes. Please do not share this code with anyone.</p>`,
    });
    console.log(`OTP email sent to ${email}`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP. Please try again.");
  }
}
