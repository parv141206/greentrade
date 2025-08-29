import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export async function sendOtp(email: string, otp: string) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
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
