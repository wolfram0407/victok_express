import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";

import { config } from "./config/config.js";

import userRouter from "./src/router/user.js";
import lockerTypeRouter from "./src/router/lockerType.js";
import lockerRouter from "./src/router/locker.js";
import customerRouter from "./src/router/customer.js";

const TIME_ZONE = "Asia/Seoul";
const options = {
  timezone: TIME_ZONE,
};

const app = express();

app.use(express.json({ limit: "3mb" }));
app.use(morgan("dev"));
app.use(cors());
app.use(helmet());

app.use("/api/user", userRouter);
app.use("/api/locker", [lockerRouter, lockerTypeRouter]);
app.use("/api/customer", customerRouter);

app.listen(config.host.port, () => {
  console.log("Connected 4000 port.");
});
app.get("/", (req, res) => {
  res.send("Hello World!");
});
