import express from "express";
import { body, param } from "express-validator";
import { db } from "../db/database.js";
import { isAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

// router.post(
//   "/locker/create",
//   isAuth,
//   [

//   ],
//   (req, res, next) => {
//     const { customerName, customerPhone, lockerType, lockerNumber, startDate, endDate, charge, paid, memo } = req.body;

//     console.log("데이터", customerName, customerPhone, lockerType, lockerNumber, startDate, endDate, charge, paid, memo);
//     return res.status(200).json({});
//   }
// );

// export default router;

// 락카 구분 등록
router.post(
  "/create",
  isAuth,
  [
    body("customerName").trim().notEmpty().withMessage("사용자 이름을 입력해 주세요."),
    body("customerPhone").trim().notEmpty().withMessage("사용자 휴대폰 번호를 입력해 주세요."),
    body("lockerTypeIdx").trim().notEmpty().withMessage("라커 구분을 입력해 주세요."),
    body("lockerNumber").trim().notEmpty().withMessage("라커 번호를 입력해 주세요."),
    body("startDate").trim().notEmpty().withMessage("시작일을 입력해 주세요."),
    body("endDate").trim().notEmpty().withMessage("종료일을 입력해 주세요."),
    body("periodTypeIdx").trim().notEmpty().withMessage("요금제를 입력해 주세요."),
    body("paid").trim().notEmpty().withMessage("수납 여부를 입력해 주세요."),
    body("memo").trim().optional(),
    validate,
  ],
  async (req, res, next) => {
    const { customerName, customerPhone, lockerTypeIdx, lockerNumber, startDate, periodTypeIdx, endDate, paid, memo } = req.body;

    // locker 테이블에 데이터 추가

    const checkLocker = await db
      .execute(`SELECT * From lockers where  lockerType_id = ? && locker_number = ? && deleted_at IS NULL;`, [lockerTypeIdx, lockerNumber])
      .then((result) => result[0][0]);
    if (checkLocker) {
      return res.status(409).json({
        message: `해당 락카에 이미 등록되어 있습니다`,
      });
    }
    console.log("!", checkLocker);
    //입력 번호에 회원이 있는지 확인
    let checkUser = await db
      .execute(`SELECT * From customer where phone = ? && deleted_time	 IS NULL;`, [customerPhone])
      .then((result) => result[0][0]);

    // 동일한 번호에 이름이 다른 경우
    if (customerName !== checkUser?.name && checkUser?.name !== undefined) {
      return res.status(409).json({
        message: `해당 번호에 등록된 회원이 있습니다`,
      });
    }

    // 처음 등록하는 경우 Customer 등록
    if (!checkUser) {
      console.log("!");

      await db.execute("INSERT INTO customer ( user_idx, name, phone,memo,agree_marketing ) VALUES (?,?,?,?,?)", [
        req.authorizedUser,
        customerName,
        customerPhone,
        memo,
        0,
      ]);

      checkUser = await db
        .execute(`SELECT * From customer where phone = ? && deleted_time	 IS NULL;`, [customerPhone])
        .then((result) => result[0][0]);
    }

    await db.execute(
      "INSERT INTO lockers (user_id,customer_id, lockerType_id, locker_number, charge_id, start_day, end_day,paid) VALUES (?,?,?,?,?,?,?,?)",
      [req.authorizedUser, checkUser.idx, lockerTypeIdx, lockerNumber, periodTypeIdx, convertDate(startDate), convertDate(endDate), paid]
    );

    return res.status(200).json({
      message: `등록완료`,
    });
  }
);

const convertDate = (input) => {
  // 문자열을 파싱하여 연도, 월, 일로 나누기
  const year = input.substring(0, 4); // "24" -> "2024"
  const month = input.substring(4, 6) - 1; // "05" -> 4 (자바스크립트에서 월은 0부터 시작)
  const day = input.substring(6, 8); // "07"

  // Date 객체 생성
  const date = new Date(year, month, day);
  // MySQL DATETIME(6) 형식으로 변환 (YYYY-MM-DD HH:MM:SS.000000)
  const formattedDate = date.toISOString().slice(0, 19).replace("T", " ") + ".000000";
  return formattedDate;
};
export default router;
