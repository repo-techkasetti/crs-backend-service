import express from "express";
import {
  createCenterModality,
  createCenter,
  createMachine,
  createModality,
  createOperator,
  getCenterModalities,
  createTestConfig,
  getCenters,
  getMachines,
  getModalities,
  getOperators,
  getTestConfigs,
  getVendors,
  updateTestConfigPrice,
  upsertAvailabilityRule,
} from "../../controllers/adminSetupController";

const router = express.Router();

router.get("/vendors", getVendors);
router.get("/centers", getCenters);
router.post("/centers", createCenter);
router.get("/center-modalities", getCenterModalities);
router.post("/center-modalities", createCenterModality);
router.get("/machines", getMachines);
router.post("/machines", createMachine);
router.get("/operators", getOperators);
router.post("/operators", createOperator);

router.get("/modalities", getModalities);
router.post("/modalities", createModality);

router.get("/test-configs", getTestConfigs);
router.post("/test-configs", createTestConfig);
router.patch("/test-configs/:testConfigId/price", updateTestConfigPrice);

router.patch("/availability-rules/:machineId/:dayOfWeek", upsertAvailabilityRule);

export default router;
