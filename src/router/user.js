import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { body } from "express-validator";
import { db } from "../db/database.js";

import { validate } from "../middleware/validate.js";
import { isAuth } from "../middleware/auth.js";
import { smsPush } from "../middleware/aligo.js";
import { config } from "../../config/config.js";
import { redis } from "../../config/redis.config.js";

import dayjs from "dayjs";

const router = express.Router();

redis.on("connect", () => {
  console.info("Redis connected!");
});
redis.on("error", (err) => {
  console.error("Redis Client Error", err);
});
redis.connect();

// 이메일 중복 체크
router.post("/email-check", [body("email").trim().notEmpty().withMessage("이메일을 입력해 주세요."), validate], async (req, res) => {
  try {
    const { email } = req.body;
    const foundEmail = await db.execute("SELECT email FROM user WHERE email=?", [email]).then((result) => result[0][0]);
    if (foundEmail) {
      return res.status(409).json({ message: `${email}는 이미 존재하는 이메일입니다.` });
    } else {
      return res.status(200).json({ message: `${email}는 사용 가능한 이메일입니다.` });
    }
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

// 인증번호 발송 - 회원가입
router.post(
  "/auth-send",
  [body("phoneNumber").trim().notEmpty().withMessage("핸드폰 번호를 입력해 주세요."), validate],
  async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      console.log(phoneNumber);
      // 중복 여부 확인
      const isMember = await db
        .execute("SELECT idx FROM user WHERE phone= ? &&deleted_time IS NULL", [phoneNumber])
        .then((result) => result[0][0]);

      console.log(isMember);
      if (isMember) {
        return res.status(409).json({ message: "이미 가입된 번호입니다." });
      }

      // 랜덤 숫자 생성
      const authNumber = generateRandomCode(4);
      // redis에 랜덤 숫자 저장
      await redis.set(authNumber, phoneNumber);
      await redis.expire(authNumber, 60 * 5);
      smsPush(phoneNumber, authNumber);

      res.status(201).json({
        message: "success",
      });
    } catch (e) {
      console.log(e);
      res.sendStatus(500);
    }
  }
);

// 인증번호 발송 - 비밀번호 재설정
router.post(
  "/change/password/auth-send",
  [body("phoneNumber").trim().notEmpty().withMessage("핸드폰 번호를 입력해 주세요."), validate],
  async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      // 회원 여부 확인
      const isMember = await db
        .execute("SELECT idx FROM user WHERE phone='?'&&deleted_time IS NULL", [phoneNumber])
        .then((result) => result[0][0]);
      if (!isMember) {
        return res.status(401).json({ message: "회원이 아닙니다." });
      }
      // 랜덤 숫자 생성
      const authNumber = generateRandomCode(4);

      await redis.set(authNumber, phoneNumber);
      await redis.expire(authNumber, 60 * 5);
      smsPush(phoneNumber, authNumber);
      res.status(201).json({
        message: "success",
        data: {
          authNumber,
        },
      });
    } catch (e) {
      res.sendStatus(500);
    }
  }
);

// 인증번호 확인
router.post(
  "/auth",
  [
    body("phoneNumber").trim().notEmpty().withMessage("핸드폰 번호를 입력해 주세요."),
    body("authNumber").trim().notEmpty().withMessage("인증 번호를 입력해 주세요."),
    validate,
  ],
  async (req, res) => {
    try {
      const { phoneNumber, authNumber } = req.body;
      const redisAuthNumber = await redis.get(authNumber);

      const user_idx = await db
        .execute(`SELECT idx FROM user WHERE phone='?'&&deleted_time IS NULL`, [phoneNumber])
        .then((result) => result[0][0]);
      const userIdx = user_idx && user_idx.idx ? user_idx : "";

      if (!redisAuthNumber && redisAuthNumber !== phoneNumber) {
        return res.status(400).json({ message: "인증 실패" });
      }
      return res.status(200).json({
        message: "인증 성공",
        data: {
          userIdx,
        },
      });
    } catch (e) {
      console.log(e);
      res.sendStatus(500);
    }
  }
);

// 회원가입
router.post(
  "/signup",
  [
    body("email").trim().notEmpty().withMessage("이메일을 입력해 주세요."),
    body("password").trim().notEmpty().withMessage("비밀번호를 입력해 주세요."),
    body("name").trim().notEmpty().withMessage("이름을 입력해 주세요."),
    body("phone").trim().notEmpty().withMessage("핸드폰 번호를 입력해 주세요."),
    body("agreeMarketing").trim().notEmpty().withMessage("마케팅 정보 수신 여부를 입력해 주세요."),
    body("type").trim().notEmpty().withMessage("시설 유형을 입력해 주세요."),
    body("storeName").trim().notEmpty().withMessage("시설 이름을 입력해 주세요."),
    body("zipCode").trim().notEmpty().withMessage("우편 번호를 입력해 주세요."),
    body("address1").trim().notEmpty().withMessage("주소를 입력해 주세요."),
    body("address2").trim().notEmpty().withMessage("상세 주소를 입력해 주세요."),
    body("contact").trim().notEmpty().withMessage("시설 연락처를 입력해 주세요."),
    validate,
  ],
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      const { email, password, name, phone, agreeMarketing, type, storeName, zipCode, address1, address2, contact } = req.body;
      const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);
      conn.beginTransaction();
      const user = await conn.query("INSERT INTO user (email, password, name, phone,  agree_marketing) VALUES (?,?,?,?,?)", [
        email,
        hashedPassword,
        name,
        phone,
        agreeMarketing,
      ]);
      // 가맹점 생성
      const store = await conn.query(
        "INSERT INTO store (user_idx, type, name, zip_code, address1, address2, contact) VALUES (?,?,?,?,?,?,?)",
        [user[0].insertId, type, storeName, zipCode, address1, address2, contact]
      );

      // 무료 이용권 생성
      const paymentHistory = await conn.query(
        "INSERT INTO payment_history (user_idx, payment_name, is_default, amount, paid_time, start_date, end_date) VALUES (?,?,?,?,?,?,?)",
        [user[0].insertId, "무료", 1, 0, new Date(), dayjs().format("YYYY-MM-DD"), null]
      );

      //tag 생성
      const tagType = await conn.query("INSERT INTO tag_type (user_idx, name) VALUES (?,?)", [user[0].insertId, "기본"]);
      await conn.commit();
      res.sendStatus(201);
    } catch (e) {
      console.log(e);
      conn.rollback();
      res.sendStatus(500);
    } finally {
      conn.release();
    }
  }
);

// 로그인
router.post(
  "/login",
  [
    body("email").trim().notEmpty().withMessage("이메일을 입력해 주세요."),
    body("password").trim().notEmpty().withMessage("비밀번호를 입력해 주세요."),
    validate,
  ],
  async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log(email, password);
      const found = await db.execute("SELECT * FROM user WHERE email=?", [email]).then((result) => result[0][0]);
      if (!found) {
        return res.status(401).json({ message: `아이디 또는 비밀번호를 확인해 주세요.` });
      }
      const checkPassword = await bcrypt.compare(password, found.password);
      if (!checkPassword) {
        return res.status(401).json({ message: `아이디 또는 비밀번호를 확인해 주세요.` });
      }
      await db.execute("UPDATE user SET login_time=? WHERE email=?", [new Date(), email]);
      const token = jwt.sign({ idx: found.idx }, config.jwt.secretKey);
      delete found.password;
      delete found.deleted_time;

      return res.status(200).json({
        token: token,
        data: {
          userInfo: found,
        },
      });
    } catch (e) {
      console.log(e);
      res.sendStatus(500);
    }
  }
);

// 개인 정보 & 시설 정보 불러오기
router.get("/info", isAuth, async (req, res) => {
  try {
    const data = await db
      .execute(
        `SELECT 
          user.idx, user.phone, user.email, user.name as user_name, 
          store.store_id, store.type, store.name as store_name,store.zip_code, store.address1, store.address2, store.contact
          FROM user JOIN store ON user.idx=store.user_idx WHERE user.idx=?
        `,
        [req.authorizedUser]
      )
      .then((result) => {
        return result[0][0];
      });
    res.status(200).json(data);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

// 이용 약관 & 개인정보 처리방침 링크 받아오기
router.get("/terms", async (req, res) => {
  try {
    const link = await db.execute("SELECT * FROM setting").then((result) => result[0]);

    res.status(200).json({
      message: "success",
      data: {
        link: link[0],
      },
    });
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

// 점유 인증 시 랜덤 숫자 생성
function generateRandomCode(n) {
  let str = "";
  for (let i = 0; i < n; i++) {
    str += Math.floor(Math.random() * 10);
  }
  return str;
}
export default router;
