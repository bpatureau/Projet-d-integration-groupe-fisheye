import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as buzzerController from "../controllers/buzzer.controller";
import * as doorbellController from "../controllers/doorbell.controller";
import * as healthController from "../controllers/health.controller";
import * as locationController from "../controllers/location.controller";
import * as messageController from "../controllers/message.controller";
import * as panelController from "../controllers/panel.controller";
import * as profileController from "../controllers/profile.controller";
import * as scheduleController from "../controllers/schedule.controller";
import * as teacherController from "../controllers/teacher.controller";
import * as visitController from "../controllers/visit.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
  validateBody,
  validateQuery,
} from "../middleware/validation.middleware";
import * as schemas from "../schemas/validation.schemas";

const router = Router();

// ========================================
// ROUTES PUBLIQUES
// ========================================

router.get("/health", healthController.checkHealth);
router.post(
  "/auth/login",
  validateBody(schemas.loginSchema),
  authController.login,
);

// ========================================
// ROUTES AUTHENTIFIÉES
// ========================================

router.use(authenticate);

router.get("/profile", profileController.getProfile);
router.put(
  "/profile",
  validateBody(schemas.updateProfileSchema),
  profileController.updateProfile,
);
router.put(
  "/profile/password",
  validateBody(schemas.updatePasswordSchema),
  profileController.updatePassword,
);
router.put(
  "/profile/preferences",
  validateBody(schemas.updatePreferencesSchema),
  profileController.updatePreferences,
);
router.put(
  "/profile/status",
  validateBody(schemas.setManualStatusSchema),
  profileController.setManualStatus,
);
router.delete("/profile/status", profileController.clearManualStatus);

router.post(
  "/locations",
  validateBody(schemas.createLocationSchema),
  locationController.createLocation,
);
router.get("/locations", locationController.getAllLocations);
router.get("/locations/:id", locationController.getLocation);
router.put(
  "/locations/:id",
  validateBody(schemas.updateLocationSchema),
  locationController.updateLocation,
);
router.delete("/locations/:id", locationController.deleteLocation);
router.get("/locations/:id/teachers", locationController.getLocationTeachers);

router.post(
  "/teachers",
  validateBody(schemas.createTeacherSchema),
  teacherController.createTeacher,
);
router.get("/teachers", teacherController.getAllTeachers);
router.get("/teachers/:id", teacherController.getTeacher);
router.put(
  "/teachers/:id",
  validateBody(schemas.updateTeacherSchema),
  teacherController.updateTeacher,
);
router.delete("/teachers/:id", teacherController.deleteTeacher);
router.get("/teachers/:id/locations", teacherController.getTeacherLocations);
router.post(
  "/teachers/:id/locations/:locationId",
  teacherController.addTeacherToLocation,
);
router.delete(
  "/teachers/:id/locations/:locationId",
  teacherController.removeTeacherFromLocation,
);

router.post(
  "/doorbells",
  validateBody(schemas.createDoorbellSchema),
  doorbellController.createDoorbell,
);
router.get("/doorbells", doorbellController.getAllDoorbells);
router.get("/doorbells/:id", doorbellController.getDoorbell);
router.put(
  "/doorbells/:id",
  validateBody(schemas.updateDoorbellSchema),
  doorbellController.updateDoorbell,
);
router.delete("/doorbells/:id", doorbellController.deleteDoorbell);

router.post(
  "/buzzers",
  validateBody(schemas.createBuzzerSchema),
  buzzerController.createBuzzer,
);
router.get("/buzzers", buzzerController.getAllBuzzers);
router.get("/buzzers/:id", buzzerController.getBuzzer);
router.put(
  "/buzzers/:id",
  validateBody(schemas.updateBuzzerSchema),
  buzzerController.updateBuzzer,
);
router.delete("/buzzers/:id", buzzerController.deleteBuzzer);

router.post(
  "/panels",
  validateBody(schemas.createLEDPanelSchema),
  panelController.createPanel,
);
router.get("/panels", panelController.getAllPanels);
router.get("/panels/:id", panelController.getPanel);
router.put(
  "/panels/:id",
  validateBody(schemas.updateLEDPanelSchema),
  panelController.updatePanel,
);
router.delete("/panels/:id", panelController.deletePanel);

router.get(
  "/visits",
  validateQuery(schemas.visitFilterSchema),
  visitController.getAllVisits,
);
router.get("/visits/stats", visitController.getVisitStats);
router.get("/visits/:id", visitController.getVisit);
router.put(
  "/visits/:id/answer",
  validateBody(schemas.answerVisitSchema),
  visitController.answerVisit,
);
router.delete("/visits/:id", visitController.deleteVisit);

router.post("/schedules/sync/:locationId", scheduleController.syncSchedule);
router.get(
  "/schedules/location/:locationId",
  scheduleController.getSchedulesForLocation,
);
router.get(
  "/schedules/teacher/:teacherId",
  scheduleController.getSchedulesForTeacher,
);

router.get(
  "/messages",
  validateQuery(schemas.messageFilterSchema),
  messageController.getAllMessages,
);
router.get("/messages/unread-count", messageController.getUnreadCount);
router.get("/messages/:id", messageController.getMessage);
router.put("/messages/:id/read", messageController.markMessageAsRead);
router.put(
  "/messages/mark-all-read",
  validateBody(schemas.markAllAsReadSchema),
  messageController.markAllAsRead,
);
router.delete("/messages/:id", messageController.deleteMessage);

export default router;
