"use client";
import { LoadingButton } from "@/components/loading-button";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { CommandFeedback, Feedback, Status } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserResource } from "../hooks/use-user-resource";
import type { SharingSkill } from "../types";
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  EXPERIENCE_YEARS_PATTERN,
  formatExperienceYears,
  normalizeExperienceInput,
  skillLevelDisplay,
  skillMonogram,
  skillToneIndex,
  sortActiveLevels,
  verificationStatusLabel,
  type SkillLevelOption,
} from "./skill-presentation";
import styles from "./skills-screen.module.css";

type Intent = {
  kind: "visibility" | "archive" | "restore" | "edit";
  path: string;
  method: "POST" | "PATCH";
  body: Record<string, unknown>;
};

const toneClasses = [
  styles.tone0 ?? "",
  styles.tone1 ?? "",
  styles.tone2 ?? "",
  styles.tone3 ?? "",
] as const;

function cardToneClass(skill: SharingSkill): string {
  if (skill.archivedAt) return ` ${styles.cardArchived}`;
  if (skill.verificationStatus === "VERIFIED") return ` ${styles.cardVerified}`;
  if (skill.verificationStatus === "PENDING") return ` ${styles.cardPending}`;
  if (skill.verificationStatus === "REJECTED") return ` ${styles.cardRejected}`;
  return "";
}

function verificationCallout(skill: SharingSkill): {
  toneClass: string;
  icon: "shield" | "clock" | "alert";
  title: string;
  subtitle: string;
  actionLabel: string;
} {
  const status = skill.verificationStatus ?? "UNVERIFIED";
  if (status === "VERIFIED") {
    return {
      toneClass: styles.verifyLinkVerified ?? "",
      icon: "shield",
      title: "Đã xác minh chứng chỉ",
      subtitle: "Nhãn xác minh vĩnh viễn giúp học viên tin tưởng chọn bạn.",
      actionLabel: "Xem hồ sơ",
    };
  }
  if (status === "PENDING") {
    return {
      toneClass: styles.verifyLinkPending ?? "",
      icon: "clock",
      title: "Đang chờ nhân sự duyệt xác minh",
      subtitle: "Yêu cầu xác minh của bạn đang trong hàng chờ kiểm tra.",
      actionLabel: "Theo dõi",
    };
  }
  if (status === "REJECTED") {
    return {
      toneClass: styles.verifyLinkRejected ?? "",
      icon: "alert",
      title: "Yêu cầu xác minh bị từ chối",
      subtitle:
        skill.latestVerification?.rejectReason?.trim() ||
        "Xem lý do từ chối và bổ sung chứng chỉ để nộp lại.",
      actionLabel: "Xem & nộp lại",
    };
  }
  if (skill.archivedAt) {
    return {
      toneClass: "",
      icon: "shield",
      title: "Hồ sơ xác minh kỹ năng",
      subtitle: "Khôi phục kỹ năng trước khi gửi yêu cầu xác minh mới.",
      actionLabel: "Xem lịch sử",
    };
  }
  return {
    toneClass: "",
    icon: "shield",
    title: "Nộp chứng chỉ để nhận nhãn Đã xác minh",
    subtitle: "Hiển thị nổi bật hơn khi học viên lọc người dạy đã xác minh.",
    actionLabel: "Xác minh ngay",
  };
}

export function SkillManagementCard({
  skill,
  blocked,
  reload,
}: Readonly<{
  skill: SharingSkill;
  blocked: boolean;
  reload: () => void;
}>) {
  const { request } = useUserSession();
  const command = useUserCommand(true);

  const [editing, setEditing] = useState<SharingSkill>();
  const [confirmMode, setConfirmMode] = useState<"archive" | "restore" | null>(
    null,
  );
  const [expanded, setExpanded] = useState(false);
  const [intent, setIntent] = useState<Intent>();
  const [notice, setNotice] = useState<string>();

  const disabled = blocked || command.pending || command.uncertain;
  const pendingKind = command.pending ? intent?.kind : undefined;
  const verificationStatus = skill.verificationStatus ?? "UNVERIFIED";
  const experienceText = formatExperienceYears(skill.experienceYears);
  const levelText = skillLevelDisplay(skill);
  const verify = verificationCallout(skill);
  const toneClass = toneClasses[skillToneIndex(skill.skill.name)];
  const isLongDescription =
    skill.description.length > 220 || skill.description.split("\n").length > 3;

  function openEditor() {
    setConfirmMode(null);
    setNotice(undefined);
    setEditing({ ...skill });
  }

  async function send(value: Intent) {
    setIntent(value);
    setNotice(undefined);
    const result = await command.run(
      JSON.stringify({
        path: value.path,
        method: value.method,
        body: value.body,
      }),
      (key) =>
        request(value.path, { method: value.method, body: value.body, key }),
    );
    if (result) {
      setIntent(undefined);
      setEditing(undefined);
      setConfirmMode(null);
      if (value.kind === "archive") {
        setNotice("Đã lưu trữ kỹ năng. Bạn có thể khôi phục bất kỳ lúc nào.");
      } else if (value.kind === "restore") {
        setNotice("Đã khôi phục kỹ năng về danh sách đang hoạt động.");
      } else if (value.kind === "visibility") {
        setNotice(
          skill.isVisible
            ? "Đã ẩn kỹ năng khỏi kết quả tìm kiếm công khai."
            : "Đã bật hiển thị công khai kỹ năng trên hồ sơ và tìm kiếm.",
        );
      } else {
        setNotice("Máy chủ đã lưu thay đổi kỹ năng.");
      }
      reload();
    }
  }

  function act(action: "archive" | "restore" | "visibility") {
    void send({
      kind: action,
      path:
        "me/skills/" + skill.id + (action === "visibility" ? "" : "/" + action),
      method: action === "visibility" ? "PATCH" : "POST",
      body: {
        expectedVersion: skill.version,
        ...(action === "visibility" ? { isVisible: !skill.isVisible } : {}),
      },
    });
  }

  return (
    <article className={styles.card + cardToneClass(skill)}>
      <div className={styles.cardTop}>
        <div className={styles.cardIdentity}>
          <span className={`${styles.emblem} ${toneClass}`} aria-hidden="true">
            {skillMonogram(skill.skill.name)}
          </span>
          <div className={styles.cardHeading}>
            <h2 className={styles.cardTitle}>{skill.skill.name}</h2>
          </div>
        </div>

        <div className={styles.badgeCluster}>
          <Status
            value={verificationStatus}
            label={verificationStatusLabel(verificationStatus)}
          />
          {skill.archivedAt ? (
            <span className={`${styles.statePill} ${styles.stateArchived}`}>
              <ProductIcon name="archive" size={12} />
              Đã lưu trữ
            </span>
          ) : skill.isVisible ? (
            <span className={`${styles.statePill} ${styles.stateVisible}`}>
              <ProductIcon name="eye" size={12} />
              Đang hiển thị
            </span>
          ) : (
            <span className={`${styles.statePill} ${styles.stateHidden}`}>
              <ProductIcon name="eyeOff" size={12} />
              Đang ẩn
            </span>
          )}
        </div>
      </div>

      <div className={styles.metaPills}>
        <span className={styles.metaPill}>
          <ProductIcon name="award" size={13} />
          <span>{levelText}</span>
        </span>
        {experienceText && (
          <span className={styles.metaPill}>
            <ProductIcon name="clock" size={13} />
            <span>{experienceText}</span>
          </span>
        )}
      </div>

      <div className={styles.descBlock}>
        <p
          className={
            styles.descText +
            (isLongDescription && !expanded ? ` ${styles.descClamped}` : "")
          }
        >
          {skill.description}
        </p>
        {isLongDescription && (
          <button
            type="button"
            className={styles.expandBtn}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Thu gọn mô tả" : "Xem thêm mô tả"}
          </button>
        )}
      </div>

      <Link
        className={`${styles.verifyLink} ${verify.toneClass}`}
        href={"/learn/skills/" + skill.id + "/verification"}
      >
        <span className={styles.verifyLead}>
          <ProductIcon name={verify.icon} size={17} />
          <span className={styles.verifyCopy}>
            <strong>{verify.title}</strong>
            <span>{verify.subtitle}</span>
          </span>
        </span>
        <span className={styles.verifyAction}>
          {verify.actionLabel}
          <ProductIcon name="arrow" size={14} />
        </span>
      </Link>

      {confirmMode && (
        <section
          className={
            styles.confirmBox +
            (confirmMode === "restore" ? ` ${styles.confirmBoxRestore}` : "")
          }
          aria-label={
            confirmMode === "restore"
              ? "Xác nhận khôi phục kỹ năng"
              : "Xác nhận lưu trữ kỹ năng"
          }
        >
          <div className={styles.confirmHeader}>
            <span className={styles.confirmIcon} aria-hidden="true">
              <ProductIcon
                name={confirmMode === "restore" ? "undo" : "archive"}
                size={16}
              />
            </span>
            <div className={styles.confirmCopy}>
              <h3>
                {confirmMode === "restore"
                  ? `Khôi phục “${skill.skill.name}”?`
                  : `Lưu trữ “${skill.skill.name}”?`}
              </h3>
              <p>
                {confirmMode === "restore"
                  ? "Khôi phục giữ lịch sử và xác minh đã có. Máy chủ kiểm tra danh mục và kỹ năng trùng trước khi khôi phục."
                  : verificationStatus === "PENDING"
                    ? "Kỹ năng này đang có yêu cầu xác minh chờ duyệt nên có thể chưa lưu trữ được. Lưu trữ sẽ gỡ kỹ năng khỏi tìm kiếm công khai nhưng giữ lại thỏa thuận và lịch sử cũ."
                    : "Lưu trữ sẽ gỡ kỹ năng khỏi tìm kiếm công khai nhưng vẫn giữ nguyên thỏa thuận và lịch sử cũ. Bạn có thể khôi phục bất kỳ lúc nào."}
              </p>
            </div>
          </div>
          <div className={styles.confirmActions}>
            <LoadingButton
              type="button"
              className="btn btn-primary"
              disabled={disabled}
              onClick={() => act(confirmMode)}
              loading={pendingKind === confirmMode}
            >
              {confirmMode === "restore"
                ? "Xác nhận khôi phục"
                : "Xác nhận lưu trữ"}
            </LoadingButton>
            <button
              type="button"
              className="btn"
              disabled={command.pending}
              onClick={() => setConfirmMode(null)}
            >
              Hủy
            </button>
          </div>
        </section>
      )}

      {!editing && (
        <>
          <CommandFeedback command={command} />
          {command.canRetry && intent && (
            <div className={styles.confirmActions}>
              <LoadingButton
                type="button"
                className="btn"
                disabled={blocked || command.pending}
                onClick={() => void send(intent)}
                loading={command.pending}
              >
                <ProductIcon name="refresh" size={14} />
                Kiểm tra lại cùng yêu cầu đã gửi
              </LoadingButton>
            </div>
          )}
        </>
      )}

      {notice && (
        <div className={styles.cardNotice} role="status">
          <span className={styles.cardNoticeLead}>
            <ProductIcon name="check" size={15} />
            <output>{notice}</output>
          </span>
          <button
            type="button"
            className={styles.noticeClose}
            aria-label="Đóng thông báo"
            onClick={() => setNotice(undefined)}
          >
            <ProductIcon name="close" size={14} />
          </button>
        </div>
      )}

      <div className={styles.cardFooter}>
        <div className={styles.primaryActions}>
          {skill.archivedAt ? (
            <LoadingButton
              type="button"
              className={`btn btn-primary ${styles.actionBtn}`}
              disabled={disabled}
              onClick={() =>
                setConfirmMode((current) =>
                  current === "restore" ? null : "restore",
                )
              }
              loading={pendingKind === "restore"}
            >
              <ProductIcon name="undo" size={14} />
              Khôi phục kỹ năng
            </LoadingButton>
          ) : (
            <>
              <button
                type="button"
                className={`btn ${styles.actionBtn}`}
                disabled={disabled}
                onClick={openEditor}
              >
                <ProductIcon name="edit" size={14} />
                Chỉnh sửa
              </button>
              <LoadingButton
                type="button"
                className={`btn ${styles.actionBtn}`}
                disabled={disabled}
                onClick={() => act("visibility")}
                loading={pendingKind === "visibility"}
              >
                <ProductIcon
                  name={skill.isVisible ? "eyeOff" : "eye"}
                  size={14}
                />
                {skill.isVisible ? "Ẩn kỹ năng" : "Hiện kỹ năng"}
              </LoadingButton>
            </>
          )}
        </div>

        {!skill.archivedAt && (
          <div className={styles.utilityActions}>
            <button
              type="button"
              className={`btn ${styles.actionBtn} ${styles.ghostBtn}`}
              disabled={disabled}
              aria-expanded={confirmMode === "archive"}
              onClick={() =>
                setConfirmMode((current) =>
                  current === "archive" ? null : "archive",
                )
              }
            >
              <ProductIcon name="archive" size={14} />
              Lưu trữ
            </button>
          </div>
        )}
      </div>

      {editing && (
        <EditSkillDrawer
          key={`${editing.id}:${editing.version}`}
          baseline={editing}
          liveSkill={skill}
          blocked={blocked}
          command={command}
          onReloadBaseline={openEditor}
          onClose={() => setEditing(undefined)}
          onSubmitPatch={(patch) =>
            void send({
              kind: "edit",
              path: "me/skills/" + skill.id,
              method: "PATCH",
              body: patch,
            })
          }
          onRetry={
            command.canRetry && intent ? () => void send(intent) : undefined
          }
        />
      )}
    </article>
  );
}

function EditSkillDrawer({
  baseline,
  liveSkill,
  blocked,
  command,
  onReloadBaseline,
  onClose,
  onSubmitPatch,
  onRetry,
}: Readonly<{
  baseline: SharingSkill;
  liveSkill: SharingSkill;
  blocked: boolean;
  command: ReturnType<typeof useUserCommand>;
  onReloadBaseline: () => void;
  onClose: () => void;
  onSubmitPatch: (patch: Record<string, unknown>) => void;
  onRetry?: () => void;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [levelId, setLevelId] = useState(baseline.levelId ?? "");
  const [description, setDescription] = useState(baseline.description);
  const [experienceYears, setExperienceYears] = useState(
    baseline.experienceYears ?? "",
  );
  const [isVisible, setIsVisible] = useState(baseline.isVisible);
  const [validationError, setValidationError] = useState<string>();

  const levels = useUserResource<SkillLevelOption[]>(
    "skills/" + liveSkill.skill.id + "/levels",
  );
  const activeLevels = sortActiveLevels(levels.data);
  const disabled = blocked || command.pending || command.uncertain;
  const stale = baseline.version !== liveSkill.version;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const trimmedDescription = description.trim();
  const descriptionLength = trimmedDescription.length;
  const descriptionShortBy = Math.max(
    0,
    DESCRIPTION_MIN_LENGTH - descriptionLength,
  );

  function handleRequestClose() {
    if (command.pending || command.uncertain) return;
    onClose();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || stale || !levels.data || levels.error) return;
    setValidationError(undefined);

    if (!baseline.levelId && !levelId) {
      setValidationError("Vui lòng chọn trình độ phù hợp.");
      return;
    }
    if (descriptionLength < DESCRIPTION_MIN_LENGTH) {
      setValidationError(
        `Mô tả cần tối thiểu ${DESCRIPTION_MIN_LENGTH} ký tự.`,
      );
      return;
    }

    const normalizedExp = normalizeExperienceInput(experienceYears);
    if (normalizedExp && !EXPERIENCE_YEARS_PATTERN.test(normalizedExp)) {
      setValidationError(
        "Số năm kinh nghiệm phải từ 0 đến 60 và tối đa 1 chữ số thập phân (VD: 2.5).",
      );
      return;
    }

    const nextExperience = normalizedExp || null;
    const patch: Record<string, unknown> = {
      expectedVersion: baseline.version,
    };
    if (levelId && levelId !== (baseline.levelId ?? "")) {
      patch.levelId = levelId;
    }
    if (trimmedDescription !== baseline.description) {
      patch.description = trimmedDescription;
    }
    if (nextExperience !== (baseline.experienceYears ?? null)) {
      patch.experienceYears = nextExperience;
    }
    if (isVisible !== baseline.isVisible) {
      patch.isVisible = isVisible;
    }
    if (Object.keys(patch).length <= 1) {
      onClose();
      return;
    }
    onSubmitPatch(patch);
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        handleRequestClose();
      }}
      closedby={command.pending || command.uncertain ? "none" : "any"}
      onClose={(event) => {
        if (
          !event.currentTarget.open &&
          !command.pending &&
          !command.uncertain
        ) {
          onClose();
        }
      }}
    >
      <form className={styles.drawerForm} onSubmit={handleSubmit}>
        <header className={styles.drawerHeader}>
          <div className={styles.drawerHeaderCopy}>
            <p className={styles.drawerEyebrow}>Chỉnh sửa kỹ năng</p>
            <h2 id={titleId}>{liveSkill.skill.name}</h2>
            <p>
              Cập nhật trình độ, số năm kinh nghiệm, mô tả hướng dẫn hoặc trạng
              thái hiển thị công khai.
            </p>
          </div>
          <button
            type="button"
            className={styles.drawerClose}
            aria-label="Đóng chỉnh sửa kỹ năng"
            disabled={command.pending || command.uncertain}
            onClick={handleRequestClose}
          >
            <ProductIcon name="close" size={18} />
          </button>
        </header>

        <div className={styles.drawerBody}>
          <Feedback
            variant="inline"
            loading={levels.initialLoading}
            error={levels.error}
            reload={levels.reload}
            refreshing={!!(levels.loading && !levels.initialLoading)}
          />

          {stale && (
            <div className={styles.staleAlert} role="alert">
              <div>
                <strong>Kỹ năng đã thay đổi trên máy chủ</strong>
                <span>
                  Bản bạn đang nhập vẫn được giữ lại. Hãy đối chiếu hoặc tải bản
                  mới nhất từ máy chủ trước khi lưu.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                disabled={disabled}
                onClick={onReloadBaseline}
              >
                <ProductIcon name="refresh" size={14} />
                Thay bản nhập bằng bản mới trên máy chủ
              </button>
            </div>
          )}

          <fieldset
            className={styles.drawerFieldset}
            disabled={disabled || stale}
          >
            <div className={styles.drawerRow}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Trình độ *</span>
                <select
                  name="levelId"
                  className={styles.fieldControl}
                  value={levelId}
                  onChange={(event) => {
                    setLevelId(event.target.value);
                    setValidationError(undefined);
                  }}
                  required={!baseline.levelId}
                >
                  <option value="">Chọn trình độ</option>
                  {activeLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Kinh nghiệm (năm)</span>
                  <span className={styles.fieldOptional}>Tùy chọn</span>
                </span>
                <input
                  name="experienceYears"
                  className={styles.fieldControl}
                  inputMode="decimal"
                  placeholder="Ví dụ: 2.5"
                  value={experienceYears}
                  onChange={(event) => {
                    setExperienceYears(event.target.value);
                    setValidationError(undefined);
                  }}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Kinh nghiệm và điều bạn có thể hướng dẫn *
              </span>
              <textarea
                name="description"
                className={`${styles.fieldControl} ${styles.fieldTextarea}`}
                rows={5}
                minLength={DESCRIPTION_MIN_LENGTH}
                maxLength={DESCRIPTION_MAX_LENGTH}
                required
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setValidationError(undefined);
                }}
              />
              <span className={styles.fieldHintRow}>
                <span>
                  {descriptionShortBy > 0
                    ? `Cần thêm ${descriptionShortBy} ký tự nữa (tối thiểu ${DESCRIPTION_MIN_LENGTH}).`
                    : "Mô tả hợp lệ."}
                </span>
                <span
                  className={`${styles.charCount} ${
                    descriptionShortBy > 0
                      ? styles.charCountWarn
                      : styles.charCountOk
                  }`}
                >
                  {descriptionLength} / {DESCRIPTION_MAX_LENGTH}
                </span>
              </span>
            </label>

            <label
              className={`${styles.toggleCard} ${
                isVisible ? styles.toggleCardActive : ""
              }`}
            >
              <div className={styles.toggleCopy}>
                <strong>Hiển thị công khai trên hồ sơ &amp; tìm kiếm</strong>
                <span>
                  {isVisible
                    ? "Học viên có thể tìm thấy kỹ năng này khi tìm người hướng dẫn."
                    : "Kỹ năng đang ẩn khỏi kết quả tìm kiếm công khai."}
                </span>
              </div>
              <span className={styles.switchWrap}>
                <input
                  type="checkbox"
                  name="isVisible"
                  className={styles.switchInput}
                  checked={isVisible}
                  onChange={(event) => setIsVisible(event.target.checked)}
                />
                <span className={styles.switchTrack} aria-hidden="true" />
              </span>
            </label>
          </fieldset>

          {validationError && (
            <p className={styles.fieldError} role="alert">
              {validationError}
            </p>
          )}

          <CommandFeedback command={command} />
        </div>

        <footer className={styles.drawerFooter}>
          {onRetry && (
            <LoadingButton
              type="button"
              className="btn"
              disabled={blocked || command.pending}
              onClick={onRetry}
              loading={command.pending}
            >
              <ProductIcon name="refresh" size={14} />
              Kiểm tra lại cùng yêu cầu đã gửi
            </LoadingButton>
          )}
          <button
            type="button"
            className="btn"
            disabled={command.pending || command.uncertain}
            onClick={handleRequestClose}
          >
            Đóng
          </button>
          <LoadingButton
            className="btn btn-primary"
            type="submit"
            disabled={disabled || stale || !levels.data || !!levels.error}
            loading={command.pending}
          >
            <ProductIcon name="check" size={16} />
            Lưu chỉnh sửa
          </LoadingButton>
        </footer>
      </form>
    </dialog>
  );
}
