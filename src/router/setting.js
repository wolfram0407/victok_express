import express from "express";
import { body, param } from "express-validator";

import { isAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { db } from "../db/database.js";
import bcrypt from "bcrypt";

import { config } from "../../config/config.js";
const router = express.Router();

/*
로그인 된 이용자 정보 조회 
*/
router.get("/user-info", isAuth, async (req, res, next) => {
  const loginUser = req.authorizedUser;

  const userInfoInfo = await db
    .execute(`SELECT * FROM user WHERE idx= ? && deleted_time IS NULL;`, [loginUser])
    .then((result) => result[0][0]);
  delete userInfoInfo.password;
  return res.status(200).json({
    message: "success",
    data: {
      userInfoInfo,
    },
  });
});
/*
로그인 된 이용자 정보 수정 
*/
router.put(
  "/user-info",
  isAuth,
  [
    body("name").trim().notEmpty().withMessage("이름을 입력해 주세요."),
    body("phone").trim().notEmpty().withMessage("핸드폰 번호를 입력해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const loginUser = req.authorizedUser;
    const { name, phone } = req.body;

    const userInfo = await db
      .execute(`SELECT * FROM user WHERE idx= ? && deleted_time IS NULL;`, [loginUser])
      .then((result) => result[0][0]);

    if (!userInfo) {
      return res.status(404).json({ message: "Store not found" });
    }

    const hasChanges = userInfo.name !== name || userInfo.phone !== phone;

    if (!hasChanges) {
      return res.status(200).json({ message: "success" });
    }

    await db.execute(`UPDATE user SET name = ?, phone = ? WHERE idx = ? AND deleted_time IS NULL;`, [name, phone, loginUser]);
    return res.status(200).json({ message: "success" });
  }
);

/*
로그인 된 이용자가 시설 정보 조회 
*/
router.get("/store-info", isAuth, async (req, res, next) => {
  const loginUser = req.authorizedUser;

  const storeInfo = await db
    .execute(`SELECT * FROM store WHERE user_idx= ? && deleted_time IS NULL;`, [loginUser])
    .then((result) => result[0][0]);

  return res.status(200).json({
    message: "success",
    data: {
      storeInfo,
    },
  });
});
/*
로그인 된 이용자가 시설 정보 수정
*/
router.put(
  "/store-info",
  isAuth,
  [
    body("type").trim().notEmpty().withMessage("시설 유형을 입력해 주세요."),
    body("storeName").trim().notEmpty().withMessage("시설 이름을 입력해 주세요."),
    body("zipCode").trim().notEmpty().withMessage("우편 번호를 입력해 주세요."),
    body("address1").trim().notEmpty().withMessage("주소를 입력해 주세요."),
    body("address2").trim().notEmpty().withMessage("상세 주소를 입력해 주세요."),
    body("contact").trim().notEmpty().withMessage("시설 연락처를 입력해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const loginUser = req.authorizedUser;
    const { type, storeName, zipCode, address1, address2, contact } = req.body;

    const storeInfo = await db
      .execute(`SELECT * FROM store WHERE user_idx= ? && deleted_time IS NULL;`, [loginUser])
      .then((result) => result[0][0]);

    if (!storeInfo) {
      return res.status(404).json({ message: "Store not found" });
    }
    const hasChanges =
      storeInfo.type !== type ||
      storeInfo.name !== storeName ||
      storeInfo.zip_code !== zipCode ||
      storeInfo.address1 !== address1 ||
      storeInfo.address2 !== address2 ||
      storeInfo.contact !== contact;

    if (!hasChanges) {
      return res.status(200).json({ message: "success" });
    }
    await db.execute(
      `UPDATE store SET type = ?, name = ?, zip_code = ?, address1 = ?, address2 = ?, contact = ? WHERE user_idx = ? AND deleted_time IS NULL;`,
      [type, storeName, zipCode, address1, address2, contact, loginUser]
    );
    return res.status(200).json({ message: "success" });
  }
);

/*
로그인 된 이용자 비밀번호 변경 
*/
router.put(
  "/change-password",
  isAuth,
  [
    body("password").trim().notEmpty().withMessage("비밀번호를 입력해 주세요."),
    body("newPassword").trim().notEmpty().withMessage("새로운 비밀번호를 입력해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const loginUser = req.authorizedUser;
    const { password, newPassword } = req.body;

    const userInfo = await db
      .execute(`SELECT * FROM user WHERE idx= ? && deleted_time IS NULL;`, [loginUser])
      .then((result) => result[0][0]);

    if (!userInfo) {
      return res.status(404).json({ message: "Store not found" });
    }

    const checkPassword = await bcrypt.compare(password, userInfo.password);

    if (!checkPassword) {
      return res.status(401).json({ message: `비밀번호를 확인해 주세요.` });
    }
    const hasChanges = password !== newPassword;

    if (!hasChanges) {
      return res.status(200).json({ message: "success" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

    console.log(hashedPassword);
    await db.execute(`UPDATE user SET password = ? WHERE idx = ? AND deleted_time IS NULL;`, [hashedPassword, loginUser]);
    return res.status(200).json({ message: "success" });
  }
);

export default router;
