"use client";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useId, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { CommandFeedback, Feedback } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserResource } from "../hooks/use-user-resource";
import type { SharingSkill } from "../types";
import { SkillCatalogPicker } from "./skill-catalog-picker";
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  EXPERIENCE_YEARS_PATTERN,
  normalizeExperienceInput,
  sortActiveLevels,
  type SkillLevelOption,
} from "./skill-presentation";
import styles from "./skills-screen.module.css";

export function AddSkillDrawer({
  open,
  onClose,
  onCreated,
  activeSkillIds,
  archivedSkillIds,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  onCreated: (created: SharingSkill) => void;
  activeSkillIds: ReadonlySet<string>;
  archivedSkillIds: ReadonlySet<string>;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { request } = useUserSession();
  const command = useUserCommand(true);

  const [skillId, setSkillId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [description, setDescription] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [validationError, setValidationError] = useState<string>();

  const levels = useUserResource<SkillLevelOption[]>(
    open && skillId ? "skills/" + skillId + "/levels" : null,
  );
  const activeLevels = sortActiveLevels(levels.data);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        if (dialog.open) dialog.close();
        document.body.style.overflow = previousOverflow;
      };
    }
    if (dialog.open) dialog.close();
  }, [open]);

  function resetDraft() {
    setSkillId("");
    setLevelId("");
    setDescription("");
    setExperienceYears("");
    setIsVisible(true);
    setValidationError(undefined);
  }

  function handleRequestClose() {
    if (command.pending) return;
    onClose();
  }

  function handleSelectSkill(nextId: string) {
    setSkillId(nextId);
    setLevelId("");
    setValidationError(undefined);
  }

  const trimmedDescription = description.trim();
  const descriptionLength = trimmedDescription.length;
  const descriptionShortBy = Math.max(
    0,
    DESCRIPTION_MIN_LENGTH - descriptionLength,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(undefined);

    if (!skillId) {
      setValidationError("Vui lòng chọn một kỹ năng từ danh mục.");
      return;
    }
    if (!levelId) {
      setValidationError("Vui lòng chọn trình độ phù hợp.");
      return;
    }
    if (descriptionLength < DESCRIPTION_MIN_LENGTH) {
      setValidationError(
        `Mô tả cần tối thiểu ${DESCRIPTION_MIN_LENGTH} ký tự để học viên hiểu bạn có thể hướng dẫn gì.`,
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

    const body = {
      skillId,
      levelId,
      description: trimmedDescription,
      ...(normalizedExp ? { experienceYears: normalizedExp } : {}),
      isVisible,
    };

    const result = await command.run(JSON.stringify(body), (key) =>
      request<SharingSkill>("me/skills", { method: "POST", key, body }),
    );
    if (result) {
      resetDraft();
      onCreated(result.data);
    }
  }

  if (!open) return null;

  const canSubmit =
    Boolean(skillId) &&
    Boolean(levels.data) &&
    !command.pending &&
    (!command.uncertain || command.canRetry);

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        handleRequestClose();
      }}
      closedby={command.pending ? "none" : "any"}
      onClose={(event) => {
        if (!event.currentTarget.open && !command.pending) {
          onClose();
        }
      }}
    >
      <form
        className={styles.drawerForm}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <header className={styles.drawerHeader}>
          <div className={styles.drawerHeaderCopy}>
            <p className={styles.drawerEyebrow}>Năng lực chia sẻ</p>
            <h2 id={titleId}>Thêm kỹ năng mới</h2>
            <p>
              Chọn kỹ năng từ danh mục chuẩn và chia sẻ kinh nghiệm bạn có thể
              hướng dẫn 1:1.
            </p>
          </div>
          <button
            type="button"
            className={styles.drawerClose}
            aria-label="Đóng bảng thêm kỹ năng"
            disabled={command.pending}
            onClick={handleRequestClose}
          >
            <ProductIcon name="close" size={18} />
          </button>
        </header>

        <div className={styles.drawerBody}>
          <SkillCatalogPicker
            value={skillId}
            onChange={handleSelectSkill}
            disabled={command.pending || command.uncertain}
            activeSkillIds={activeSkillIds}
            archivedSkillIds={archivedSkillIds}
          />

          <Feedback
            variant="inline"
            loading={levels.initialLoading}
            error={levels.error}
            reload={levels.reload}
            refreshing={!!(levels.loading && !levels.initialLoading)}
          />

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
                required
                disabled={!skillId || !levels.data || command.pending}
              >
                <option value="">
                  {skillId ? "Chọn trình độ" : "Chọn kỹ năng trước"}
                </option>
                {activeLevels.map((level) => (
                  <option value={level.id} key={level.id}>
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
                disabled={command.pending}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>
                Kinh nghiệm và điều bạn có thể hướng dẫn *
              </span>
            </span>
            <textarea
              name="description"
              className={`${styles.fieldControl} ${styles.fieldTextarea}`}
              rows={5}
              minLength={DESCRIPTION_MIN_LENGTH}
              maxLength={DESCRIPTION_MAX_LENGTH}
              required
              placeholder="Ví dụ: Mình có 3 năm làm UI/UX với Figma, có thể hướng dẫn từ wireframe, design system đến prototype cho người mới bắt đầu…"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setValidationError(undefined);
              }}
              disabled={command.pending}
            />
            <span className={styles.fieldHintRow}>
              <span>
                {descriptionShortBy > 0
                  ? `Cần thêm ${descriptionShortBy} ký tự nữa (tối thiểu ${DESCRIPTION_MIN_LENGTH}).`
                  : "Mô tả đạt yêu cầu — càng cụ thể học viên càng dễ chọn bạn."}
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
                  ? "Học viên có thể tìm thấy bạn khi tìm người hướng dẫn kỹ năng này."
                  : "Kỹ năng được lưu riêng tư và tạm ẩn khỏi kết quả tìm kiếm."}
              </span>
            </div>
            <span className={styles.switchWrap}>
              <input
                type="checkbox"
                name="isVisible"
                className={styles.switchInput}
                checked={isVisible}
                onChange={(event) => setIsVisible(event.target.checked)}
                disabled={command.pending}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </span>
          </label>

          {validationError && (
            <p className={styles.fieldError} role="alert">
              {validationError}
            </p>
          )}

          <CommandFeedback command={command} />
        </div>

        <footer className={styles.drawerFooter}>
          <button
            type="button"
            className="btn"
            disabled={command.pending}
            onClick={handleRequestClose}
          >
            Hủy
          </button>
          <LoadingButton
            type="submit"
            className="btn btn-primary"
            disabled={!canSubmit}
            loading={command.pending}
          >
            <ProductIcon name="check" size={16} />
            {command.canRetry ? "Kiểm tra lại yêu cầu đã gửi" : "Lưu kỹ năng"}
          </LoadingButton>
        </footer>
      </form>
    </dialog>
  );
}
