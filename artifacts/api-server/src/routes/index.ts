import { Router, type IRouter } from "express";
import healthRouter from "./health";
import patientsRouter from "./patients";
import proceduresRouter from "./procedures";
import callsRouter from "./calls";
import alertsRouter from "./alerts";
import templatesRouter from "./templates";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import vapiRouter from "./vapi";

const router: IRouter = Router();

router.use(healthRouter);
router.use(patientsRouter);
router.use(proceduresRouter);
router.use(callsRouter);
router.use(alertsRouter);
router.use(templatesRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(vapiRouter);

export default router;
