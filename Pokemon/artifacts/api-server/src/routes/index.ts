import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pokemonRouter from "./pokemon";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pokemonRouter);

export default router;
