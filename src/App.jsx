import { useEffect, useMemo, useState } from "react";
import { Calculator, GraduationCap } from "lucide-react";
import { YONONAKA_FEES, YOYOGI_FEES } from "./config/fees";

function buildPlan(admissionType, inputCredits) {
  if (admissionType === "new") return [25, 25, 25];
  if (admissionType !== "transfer") return [];

  const remaining = Math.max(0, 75 - Number(inputCredits || 0));

  if (remaining >= 71) {
    const base = Math.floor(remaining / 3);
    const remainder = remaining % 3;
    return [base + (remainder > 0 ? 1 : 0), base + (remainder > 1 ? 1 : 0), base];
  }

  if (remaining >= 35) {
    const base = Math.floor(remaining / 2);
    return [base + (remaining % 2), base];
  }

  return remaining ? [remaining] : [];
}

function getYoyogiBase(householdType, yearIndex) {
  const baseFees = YOYOGI_FEES[householdType] || YOYOGI_FEES.general;

  return {
    ...baseFees,
    出願料: yearIndex === 0 ? baseFees.出願料 : 0,
    入学金: yearIndex === 0 ? baseFees.入学金 : 0,
  };
}

function getYononakaBase() {
  return {
    入学金: YONONAKA_FEES.入学金,
    教科書代: YONONAKA_FEES.教科書代,
    登録料: YONONAKA_FEES.登録料,
    諸雑費: YONONAKA_FEES.諸雑費,
    学級費: YONONAKA_FEES.学級費,
    年間保険料: YONONAKA_FEES.年間保険料,
    スクーリング費用: YONONAKA_FEES.スクーリング費用,
    賛助会員費: YONONAKA_FEES.賛助会員費,
  };
}

function sumValues(obj) {
  return Object.values(obj).reduce((sum, value) => sum + (value || 0), 0);
}

function runSelfChecks() {
  console.assert(JSON.stringify(buildPlan("new", "")) === JSON.stringify([25, 25, 25]));
  console.assert(JSON.stringify(buildPlan("transfer", "20")) === JSON.stringify([28, 27]));
  console.assert(JSON.stringify(buildPlan("transfer", "1")) === JSON.stringify([25, 25, 24]));
  console.assert(JSON.stringify(buildPlan("transfer", "50")) === JSON.stringify([25]));
  console.assert((31 > 30 ? (31 - 30) * YOYOGI_FEES.超過単位単価 : 0) === 8000);
  console.assert(getYoyogiBase("general", 1).入学金 === 0);
  console.assert(getYononakaBase().登録料 === 0);
}

runSelfChecks();

export default function WebApp() {
  const searchParams = new URLSearchParams(window.location.search);

  const detailHousehold = searchParams.get("household");
  const detailAdmission = searchParams.get("admission");
  const detailYear = searchParams.get("year");
  const detailCredits = searchParams.get("credits");
  const detailTransferMonth = searchParams.get("transferMonth");

  const [householdType] = useState(detailHousehold || "support");
  const [admissionType, setAdmissionType] = useState(detailAdmission || "new");
  const [inputCredits, setInputCredits] = useState(detailCredits || "");
  const [newAdmissionYear, setNewAdmissionYear] = useState(detailYear || "2027-04");

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const transferMonthOptions = useMemo(() => {
    const options = [];

    for (let month = 4; month <= 12; month += 1) {
      options.push({
        value: `2026-${String(month).padStart(2, "0")}`,
        label: `2026年度 ${month}月`,
        month,
      });
    }

    for (let month = 1; month <= 3; month += 1) {
      options.push({
        value: `2027-${String(month).padStart(2, "0")}`,
        label: `2026年度 ${month}月`,
        month,
      });
    }

    return options;
  }, []);

  const defaultTransferValue = useMemo(() => {
    const matched = transferMonthOptions.find((option) => option.month === currentMonth);
    return matched ? matched.value : transferMonthOptions[0]?.value || "";
  }, [currentMonth, transferMonthOptions]);

  const [transferMonthValue, setTransferMonthValue] = useState(
    detailTransferMonth || defaultTransferValue,
  );

  const newAdmissionOptions = [
    { value: "2027-04", label: "2027年4月入学" },
    { value: "2028-04", label: "2028年4月入学" },
  ];

  const isAdmissionSelected = admissionType !== "";
  const needsNewAdmissionYear = admissionType === "new";
  const needsTransferInputs = admissionType === "transfer";
  const isTransferCreditsValid = admissionType !== "transfer" || inputCredits !== "";
  const isReadyToCalculate = isAdmissionSelected && isTransferCreditsValid;

  const units = useMemo(() => {
    if (!isReadyToCalculate) return [];
    return buildPlan(admissionType, inputCredits);
  }, [admissionType, inputCredits, isReadyToCalculate]);

  const transferTiming = useMemo(() => {
    if (admissionType !== "transfer" || !transferMonthValue || units.length === 0) return null;

    const [yearText, monthText] = transferMonthValue.split("-");
    const startYear = Number(yearText);
    const startMonth = Number(monthText);
    const fiscalEndYear = startMonth <= 3 ? startYear : startYear + 1;
    const graduationYear = fiscalEndYear + (units.length - 1);
    const totalMonths = (graduationYear - startYear) * 12 + (3 - startMonth);

    return {
      graduationYear,
      totalMonths,
      years: Math.floor(totalMonths / 12),
      months: totalMonths % 12,
    };
  }, [admissionType, transferMonthValue, units.length]);

  const admissionLabel =
    admissionType === "new"
      ? "中学校からの新入学"
      : admissionType === "transfer"
        ? "他高校からの転入"
        : "未選択";

  const transferMonthLabel =
    transferMonthOptions.find((option) => option.value === transferMonthValue)?.label || "未選択";

  const newAdmissionLabel =
    newAdmissionOptions.find((option) => option.value === newAdmissionYear)?.label || "未選択";

  // 学費計算ロジックは将来復活できるよう残しています。
  const yearlyData = useMemo(() => {
    if (!isReadyToCalculate) return [];

    return units.map((unitCount, yearIndex) => {
      const yoyogiBase = getYoyogiBase(householdType, yearIndex);
      const yononakaBase = getYononakaBase();
      const yoyogiExtra = unitCount > 30 ? (unitCount - 30) * YOYOGI_FEES.超過単位単価 : 0;
      const yonoTuition = unitCount * YONONAKA_FEES.単位単価;
      const total = sumValues(yoyogiBase) + sumValues(yononakaBase) + yoyogiExtra + yonoTuition;

      return {
        u: unitCount,
        yoyogiBase,
        yononakaBase,
        yoyogiExtra,
        yonoTuition,
        total,
      };
    });
  }, [householdType, isReadyToCalculate, units]);

  const grandTotal = yearlyData.reduce((sum, year) => sum + year.total, 0);

  const yononakaGrandTotal = yearlyData.reduce(
    (sum, year) => sum + sumValues(year.yononakaBase) + year.yonoTuition,
    0,
  );

  const yoyogiGrandTotal = yearlyData.reduce(
    (sum, year) => sum + sumValues(year.yoyogiBase) + year.yoyogiExtra,
    0,
  );

  const monthsUntilGraduation =
    admissionType === "transfer" && transferTiming
      ? Math.max(1, transferTiming.totalMonths)
      : admissionType === "new"
        ? 36
        : 0;

  const monthly = monthsUntilGraduation
    ? Math.ceil((yononakaGrandTotal + yoyogiGrandTotal) / monthsUntilGraduation)
    : 0;

  const graduationPlannedText =
    admissionType === "transfer" && transferTiming
      ? `${transferTiming.graduationYear}年3月`
      : admissionType === "new"
        ? `${Number(newAdmissionYear.slice(0, 4)) + 3}年3月`
        : "-";

  // 学費表示復活用に残しています。
  const yen = (value) => `${value.toLocaleString()} 円`;
  void grandTotal;
  void monthly;
  void yen;

  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ height }, "*");
    };

    sendHeight();

    const observer = new ResizeObserver(() => {
      sendHeight();
    });

    if (document.body) {
      observer.observe(document.body);
    }

    window.addEventListener("load", sendHeight);
    window.addEventListener("resize", sendHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("load", sendHeight);
      window.removeEventListener("resize", sendHeight);
    };
  }, [
    householdType,
    admissionType,
    inputCredits,
    newAdmissionYear,
    transferMonthValue,
    monthly,
    graduationPlannedText,
    yearlyData.length,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-2xl">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_0.7fr] lg:p-10">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur">
                <GraduationCap className="h-4 w-4" />
                卒業までのシミュレーション
              </div>

              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                卒業予定年月
              </h1>

              {/*
                ヘッダー説明文は一旦非表示。
                将来必要になった場合はここに戻します。
              */}
            </div>

            <div className="rounded-3xl bg-white/15 p-5 backdrop-blur-md">
              <div className="text-sm text-white/80">現在の選択</div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/*
                  世帯区分は一旦非表示。
                  学費版へ戻す場合はここに戻します。
                */}

                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-xs text-white/70">入学区分</div>
                  <div className="mt-1 font-semibold">{admissionLabel}</div>
                </div>

                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-xs text-white/70">選択年月</div>
                  <div className="mt-1 font-semibold">
                    {admissionType === "transfer"
                      ? transferMonthLabel
                      : admissionType === "new"
                        ? newAdmissionLabel
                        : "-"}
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-300/90 p-3 text-slate-900 shadow-lg ring-1 ring-white/30 sm:col-span-2">
                  <div className="text-xs text-slate-700">卒業予定年月</div>
                  <div className="mt-1 font-semibold">{graduationPlannedText}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <section className="rounded-[28px] bg-white p-5 shadow-lg ring-1 ring-slate-200 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <Calculator className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-xl font-bold">条件を入力してください</h2>
                <p className="text-sm text-slate-500">入力後、卒業予定年月が表示されます</p>
              </div>
            </div>

            <div className="space-y-6">
              {/*
                世帯区分選択は一旦非表示。
                学費版へ戻す場合はここに戻します。
              */}

              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-700">
                  ① 入学区分
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setAdmissionType("transfer")}
                    className={`rounded-2xl border p-4 text-left transition ${
                      admissionType === "transfer"
                        ? "border-sky-600 bg-sky-600 text-white shadow-lg"
                        : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50"
                    }`}
                  >
                    <div className="font-semibold">他高校からの転入</div>
                    <div
                      className={`mt-1 text-sm ${
                        admissionType === "transfer" ? "text-white/90" : "text-slate-500"
                      }`}
                    >
                      75単位から取得済み単位を差し引きます
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setAdmissionType("new");
                      setInputCredits("");
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      admissionType === "new"
                        ? "border-sky-600 bg-sky-600 text-white shadow-lg"
                        : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50"
                    }`}
                  >
                    <div className="font-semibold">中学校からの新入学</div>
                    <div
                      className={`mt-1 text-sm ${
                        admissionType === "new" ? "text-white/90" : "text-slate-500"
                      }`}
                    >
                      25単位 × 3年
                    </div>
                  </button>
                </div>
              </div>

              {needsNewAdmissionYear && (
                <div>
                  <label className="mb-3 block text-sm font-semibold text-slate-700">
                    ② 入学年月
                  </label>

                  <select
                    value={newAdmissionYear}
                    onChange={(e) => setNewAdmissionYear(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none transition focus:border-sky-500 focus:bg-white"
                  >
                    {newAdmissionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {needsTransferInputs && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-700">
                      ② 転入月
                    </label>

                    <select
                      value={transferMonthValue}
                      onChange={(e) => setTransferMonthValue(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none transition focus:border-sky-500 focus:bg-white"
                    >
                      {transferMonthOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-700">
                      ③ 取得済み単位数
                    </label>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={inputCredits}
                        onChange={(e) => setInputCredits(e.target.value)}
                        placeholder="例：20"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-20 text-lg outline-none transition focus:border-sky-500 focus:bg-white"
                      />

                      <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-slate-200 px-3 py-1 text-sm font-medium text-slate-600">
                        単位
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-1">
              <div className="rounded-[28px] bg-white p-5 shadow-lg ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                    <GraduationCap className="h-5 w-5" />
                  </div>

                  <div>
                    <div className="text-sm text-slate-500">卒業までの期間</div>

                    <div className="text-2xl font-bold">
                      {admissionType === "transfer" && transferTiming
                        ? `${transferTiming.years}年 ${transferTiming.months}ヶ月`
                        : admissionType === "new"
                          ? "3年"
                          : "-"}
                    </div>

                    {admissionType === "transfer" && transferTiming && (
                      <div className="mt-2 text-xs text-slate-500 leading-relaxed">
                        {transferMonthLabel} に転入した場合、
                        {transferTiming.graduationYear}年3月卒業見込みです。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/*
                学費表示は一旦非表示。
                将来復活する場合はここに戻します。

                - 月額目安カード
                - 総額目安カード
                - 学費明細ページ
                - 明細を見るボタン
                - 予約CTA
                - 年度別明細
                - 代々木高校学費明細
                - よのなか塾学費明細
                - 課税世帯返金注意書き
              */}
            </div>

            {!isReadyToCalculate && (
              <div className="rounded-[28px] bg-white p-5 shadow-lg ring-1 ring-slate-200 sm:p-6">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  入学区分を選択し、転入の場合は転入月と取得済み単位数を入力すると卒業予定年月が表示されます。
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}