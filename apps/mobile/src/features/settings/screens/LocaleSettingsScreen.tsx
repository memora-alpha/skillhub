import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FormNotice } from "@/components/FormNotice";
import { useAuthSession, useUpdateProfile } from "@/features/auth";
import type { OwnProfile } from "@/features/account";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage } from "@/lib/http/errors";
import { validTimezone } from "../utils/preferences";
import { SettingsPage } from "../components/SettingsPage";
import {
  SettingsIntro,
  SettingsSection,
  SettingsNote,
  SettingsChoice,
  SettingsSaveButton,
} from "../components/SettingsUI";
import { TimezoneField } from "../components/TimezoneField";

export function LocaleSettingsScreen({
  section,
  profile,
}: {
  section: "timezone" | "language";
  profile: OwnProfile;
}) {
  const timezone = section === "timezone";
  const { runtime } = useAuthSession();
  const generation = runtime.controller.generation;
  const mutation = useUpdateProfile();
  const { showToast } = useToast();
  const focused = useRef(false);
  const flight = useRef(false);
  const [saved, setSaved] = useState(
    timezone ? (profile.timezone ?? "") : profile.locale,
  );
  const [value, setValue] = useState(saved);
  const changed = value.trim() !== saved;
  const valid = timezone
    ? validTimezone(value.trim())
    : value === "vi" || value === "en";
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );
  const change = (next: string) => {
    if (flight.current) return;
    setValue(next);
    mutation.reset();
  };
  const save = async () => {
    if (flight.current || !changed || !valid) return;
    flight.current = true;
    try {
      const result = await mutation.mutateAsync(
        timezone
          ? { timezone: value.trim() }
          : { locale: value === "en" ? "en" : "vi" },
      );
      if (generation !== runtime.controller.generation) return;
      const confirmed = timezone ? (result.timezone ?? "") : result.locale;
      setSaved(confirmed);
      setValue(confirmed);
      if (focused.current) showToast("Đã lưu tùy chọn tài khoản.", "success");
    } catch {
      // Keep the draft and show the mutation error below; never replay automatically.
    } finally {
      flight.current = false;
    }
  };
  return (
    <SettingsPage
      title={timezone ? "Múi giờ" : "Ngôn ngữ"}
      footer={
        <SettingsSaveButton
          pending={mutation.isPending}
          disabled={!changed || !valid || mutation.isPending}
          onPress={() => {
            void save();
          }}
        />
      }
    >
      <SettingsIntro
        title={timezone ? "Theo giờ của bạn" : "Ngôn ngữ bạn muốn dùng"}
        description={
          timezone
            ? "Chọn múi giờ cho tài khoản để thuận tiện khi học tập và kết nối."
            : "Lựa chọn được lưu cùng tài khoản SkillHub của bạn."
        }
      />
      {timezone ? (
        <>
          <TimezoneField
            value={value}
            disabled={mutation.isPending}
            onChange={change}
          />
          <SettingsNote icon="calendar">
            Thay đổi này không dời giờ các buổi học đã chốt. Mỗi lịch vẫn giữ
            múi giờ riêng.
          </SettingsNote>
        </>
      ) : (
        <>
          <SettingsSection title="Ngôn ngữ tài khoản" radioGroup>
            <SettingsChoice
              label="Tiếng Việt"
              description="Vietnamese"
              selected={value === "vi"}
              disabled={mutation.isPending}
              onPress={() => change("vi")}
            />
            <SettingsChoice
              label="English"
              description="Tiếng Anh"
              selected={value === "en"}
              disabled={mutation.isPending}
              onPress={() => change("en")}
            />
          </SettingsSection>
          <SettingsNote icon="book">
            Giao diện mobile hiện dùng tiếng Việt. Lựa chọn English được lưu vào
            tài khoản; ứng dụng chưa có bản dịch tiếng Anh đầy đủ.
          </SettingsNote>
        </>
      )}
      {mutation.isError && (
        <FormNotice tone="error">
          {errorMessage(mutation.error)} Bản nháp vẫn được giữ; hãy kiểm tra tùy
          chọn đã lưu trước khi thử lại.
        </FormNotice>
      )}
    </SettingsPage>
  );
}
