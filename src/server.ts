import express from "express";
import cors from "cors";
//1
import searchService from "./services/search.service";
//2
import centerDetailRouter from "./routes/centerDetail";
//3
import { sendOtp } from "./routes/auth/sendOtp"
import { verifyOtp } from "./routes/auth/verifyOtp"
//4
import timeSlots from "./routes/timeSlots";
//5
import { getPatientList } from "./routes/patients/getPatientList"
import { createPatient } from "./routes/patients/createPatient"
import { authMiddleware } from "./middleware/authMiddleware"
import { getPatientByUpiInMobile } from "./routes/patients/getPatientByUpiInMobile";
//6
import { createBooking } from "./controllers/bookingController"
import { verifyPayment } from "./routes/payments/verifyPayment"
import { getPaymentStatus } from "./routes/payments/getPaymentStatus"
//7
import { getPatientByUpi } from "./controllers/getPatientByUpi";
import { getPatientByAadhar } from "./controllers/getPatientByAadhar";
import { registerPatient } from "./controllers/registerPatient";
import { getAppointment } from "./routes/appointments/getAppointment";
import adminRouter from "./routes/admin";
import { getOutboxStats } from "./services/outboxRelay";
import cartRouter from "./routes/cart";
import subscriptionRouter from "./routes/subscriptions";
import b2cReconciliationRouter from "./routes/b2cReconciliation";


const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/outbox/stats", async (_req, res) => {
  try {
    res.json(await getOutboxStats());
  } catch (error) {
    console.error("Outbox stats error:", error);
    res.status(500).json({ message: "Failed to fetch outbox stats" });
  }
});

// Search Service
app.post("/api/search", async (req, res) => {
  try {
    const payload = req.body ?? {}; // SAFE

    const result = await searchService(payload);

    res.json(result);
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({
      message: "Search failed",
    });
  }
});
// Center Detail Router 
app.use("/center", centerDetailRouter)
// AUTH
app.post("/api/auth/send-otp", sendOtp)
app.post("/api/auth/verify-otp", verifyOtp)
// Time Slots
app.use("/time/slots", timeSlots)
// PATIENT
app.get("/api/patients", authMiddleware, getPatientList)
app.post("/api/patients", authMiddleware, createPatient)
app.get("/api/patients/:upiId", authMiddleware, getPatientByUpiInMobile)
// PAYMENT
app.post("/api/bookings/create", createBooking)
app.post("/api/payment/verify", verifyPayment)
app.get("/api/payment/:paymentId", getPaymentStatus)
app.get("/api/appointments/:appointmentId", getAppointment)
app.use("/api/cart", cartRouter)
app.use("/api/subscriptions", subscriptionRouter)
app.use("/api/b2c/reconciliation", b2cReconciliationRouter)



// GET patient by UPI ID
app.get("/api/patient/:upi_id", getPatientByUpi);
// GET patient by Aadhaar
app.get("/api/patient/aadhaar/:aadhaar", getPatientByAadhar);
// Register patient
app.post("/api/patient/register", registerPatient);
app.use("/api/admin", adminRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://${process.env.IP_ADDRESS}:${PORT}`);
});

//npx tsx src/server.ts
