import express from "express";
import { body, param } from "express-validator";
import { db } from "../db/database.js";
import { isAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import dayjs from "dayjs";
const router = express.Router();

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
      [req.authorizedUser, checkUser.idx, lockerTypeIdx, lockerNumber, periodTypeIdx, startDate, endDate, paid]
    );

    return res.status(200).json({
      message: `등록완료`,
    });
  }
);

// 나중에 날짜로 출력 할지 어떤 방식으로 출력할지 결정되면 진행
router.get("/", isAuth, async (req, res, next) => {
  try {
    const list = await db.query(`SELECT * FROM lockers WHERE user_id = ? AND deleted_at IS NULL `, [req.authorizedUser]).then((r) => r[0]);

    const today = dayjs().format("YYYY-MM-DD");
    // /*
    // dayjs(today).diff(endDate, "day") >= 0
    // 오늘 날짜로 부터 끝나는 날까지 계산
    // 양수면 만료된 상태
    // 0 이면 만료일
    // 음수면 기간 남은 상태

    // 더 나중에 날짜 diff 적은 날짜 하면 양수로 나옴
    // */
    // console.log(today + "  " + lockerInfo.start_day + "  " + lockerInfo.end_day);
    // const todayStatus = dayjs(today).diff(lockerInfo.end_day, "day");
    // // 오늘 기준 종료 날짜가 종료되어 전체 기간 + 지난 날짜
    // // 음수면 아직 기간 남아서 시작일 부터 현재까지 계산
    // const used = todayStatus >= 0 ? dayjs(today).diff(lockerInfo.start_day, "day") : dayjs(today).diff(lockerInfo.start_day, "day");
    // console.log("사용한 날짜 : " + used);
    // const remain = todayStatus >= 0 ? 0 : dayjs(lockerInfo.end_day).diff(today, "day");
    // console.log("남은 날짜 : " + remain);
    // //   dayjs(today).diff(start_date, "day") >= 0 ? dayjs(endDate).diff(dayjs(today), "day") : dayjs(endDate).diff(start_date, "day");

    return res.status(200).json({
      message: "success",
      data: { list },
    });
  } catch (e) {
    console.log(e);
  }
});

//
router.get("/type/:typeId", isAuth, async (req, res, next) => {
  try {
    const { typeId } = req.params;
    const lockerTypeIdList = await db
      .execute(`SELECT * from lockers WHERE lockerType_id = ?  && user_id = ?  && deleted_at  IS NULL `, [typeId, req.authorizedUser])
      .then((result) => result[0]);

    return res.status(200).json({
      message: "success",
      data: { lockerTypeIdList },
    });
  } catch (e) {
    console.log(e);
  }
});

router.get("/locker-idx/:lockerId", isAuth, async (req, res, next) => {
  try {
    const { lockerId } = req.params;
    const lockerTypeIdList = await db
      .execute(`SELECT * from lockers WHERE locker_id = ?  && user_id = ?  && deleted_at  IS NULL `, [lockerId, req.authorizedUser])
      .then((result) => result[0]);

    return res.status(200).json({
      message: "success",
      data: { lockerTypeIdList },
    });
  } catch (e) {
    console.log(e);
  }
});

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

// 락카 기간 수정
// 날짜 수정을 자유롭게 만들려고 생각
// 지속적인 관리가 어려우니 자유도를 높이는게 좋을 것 같다.
router.put(
  "/",
  isAuth,
  [
    body("lockerIdx").trim().notEmpty().withMessage("라커 idx를 입력해 주세요."),
    body("startDate").trim().notEmpty().withMessage("시작일을 입력해 주세요."),
    body("endDate").trim().notEmpty().withMessage("종료일을 입력해 주세요."),
    body("chargeId").trim().notEmpty().withMessage("요금을 입력해 주세요."),
    body("paid").trim().notEmpty().withMessage("수납 여부를 입력해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const { lockerIdx, startDate, endDate, chargeId, paid } = req.body;

    console.log(lockerIdx, startDate, endDate, chargeId, paid);
    /* 변화 없으면 쿼리 실행 안하게 추가 하자*/

    const lockerInfo = await db
      .execute(`SELECT * FROM lockers WHERE locker_id=? &&deleted_at IS NULL`, [lockerIdx])
      .then((result) => result[0][0]);

    if (!lockerInfo) {
      return res.status(404).send("해당 데이터가 없습니다");
    }

    const newData = {
      start_day: startDate === lockerInfo.start_day ? lockerInfo.start_day : startDate,
      end_day: endDate === lockerInfo.end_date ? lockerInfo.end_date : endDate,
      chargeId: chargeId === lockerInfo.charge_id ? lockerInfo.charge_id : chargeId,
      paid: paid === lockerInfo.paid ? lockerInfo.paid : paid,
    };

    // UPDATE
    await db.execute(`UPDATE lockers SET start_day = ?, end_day = ?, charge_id= ?, paid= ? WHERE locker_id = ?;`, [
      newData.start_day,
      newData.end_day,
      newData.chargeId,
      newData.paid,
      lockerIdx,
    ]);

    return res.status(200).json({
      message: "success",
      data: { updated: newData },
    });
  }
);
// 락카 수납 수정
/*
1. 로그인된 상태 에서 해당 idx 검증 
2. 락카 idx를 받아서 해당 값을 조회
3. 락카 수납 정보 확인해서 다르면 변경
*/
router.put(
  "/paid",
  isAuth,
  [
    body("lockerIdx").trim().notEmpty().withMessage("라커 idx를 입력해 주세요."),
    body("paid").trim().notEmpty().withMessage("수납 여부를 입력해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const { lockerIdx, paid } = req.body;
    const lockerInfo = await db
      .execute(`SELECT * FROM lockers WHERE locker_id=? &&deleted_at IS NULL`, [lockerIdx])
      .then((result) => result[0][0]);

    if (!lockerInfo) {
      return res.status(404).send("해당 데이터가 없습니다");
    }

    if (lockerInfo.paid !== Number(paid)) {
      await db.execute(`UPDATE lockers SET paid= ? WHERE locker_id = ?;`, [paid, lockerIdx]);
      lockerInfo.paid = paid;
    }

    return res.status(200).json({
      message: "success",
      data: { lockerInfo },
    });
  }
);

// 락카 삭제
/*
1. 로그인된 상태 에서 해당 idx 검증 
2. 락카 idx를 받아서 해당 값을 조회
3. 락카 수납 정보 확인해서 다르면 변경
*/
router.delete(
  "/",
  isAuth,
  [
    body("lockerIdx").trim().notEmpty().withMessage("라커 idx를 입력해 주세요."),
    body("paid").trim().notEmpty().withMessage("수납 여부를 입력해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const { lockerIdx } = req.body;
    const lockerInfo = await db
      .execute(`SELECT * FROM lockers WHERE locker_id=? &&deleted_at IS NULL`, [lockerIdx])
      .then((result) => result[0][0]);

    if (!lockerInfo) {
      return res.status(404).send("해당 데이터가 없습니다");
    }

    const deleteLocker = await db.execute(`UPDATE lockers SET deleted_at= ? WHERE locker_id = ?;`, [new Date(), lockerIdx]);

    return res.status(200).json({
      message: "success",
      data: { deleteLocker },
    });
  }
);

// 라커 수리중 설정
router.put(
  "/locker-status",
  isAuth,
  [
    body("lockerIdx").trim().notEmpty().withMessage("라커 idx를 입력해 주세요."),
    body("status").trim().notEmpty().withMessage("락카 상태를 입력해 주세요."),
    validate,
  ],
  async (req, res, next) => {
    const { lockerIdx, status } = req.body;
    const lockerInfo = await db
      .execute(`SELECT * FROM lockers WHERE locker_id=? &&deleted_at IS NULL`, [lockerIdx])
      .then((result) => result[0][0]);

    if (!lockerInfo) {
      return res.status(404).send("해당 데이터가 없습니다");
    }

    if (lockerInfo.locker_status !== Number(status)) {
      await db.execute(`UPDATE lockers SET locker_status= ? WHERE locker_id = ?;`, [status, lockerIdx]);
    }

    return res.status(200).json({
      message: "success",
      data: {},
    });
  }
);

// 사용 중인 라커 번호
/*
1. 로그인 정보 확인
2. 락카 구분 idx(lockerType_id)받아서 총 락카 개수 확인 
3. 락카 갯수 중에 사용 중인 락카는 1 / 비어 있으면 0 을 표시하는 배열 계산
4. 해당 배열 리턴
*/

// [엑셀 다운로드용] 라커 전체 목록 & 검색 (항목별 오름차순/내림차순 정렬) - 리스트

// 회원 정보로 메모 불러오기 (라커 이용자 추가 시 사용)

export default router;
