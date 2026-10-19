import { ChoiceGroup } from "@/components/choice-group";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { useProductPreview } from "../context";
export function LocalePreviewScreen({
  section,
}: {
  section: "timezone" | "language";
}) {
  const locale = useProductPreview();
  const timezone = section === "timezone";
  return (
    <FeaturePage
      title={timezone ? "Múi giờ" : "Ngôn ngữ"}
      back="/account-settings"
    >
      <Panel title={timezone ? "Giờ hiển thị mẫu" : "Lựa chọn ngôn ngữ mẫu"}>
        <ChoiceGroup
          label={timezone ? "Múi giờ" : "Ngôn ngữ"}
          value={locale[section]}
          options={
            timezone
              ? [
                  "Asia/Ho_Chi_Minh",
                  "Asia/Tokyo",
                  "UTC",
                  "Europe/London",
                  "America/New_York",
                ]
              : ["Tiếng Việt", "English"]
          }
          onChange={(value) => locale.setLocale(section, value)}
        />
        {timezone && (
          <Copy>
            {new Intl.DateTimeFormat("vi-VN", {
              timeZone: locale.timezone,
              dateStyle: "full",
              timeStyle: "short",
            }).format(new Date())}
          </Copy>
        )}
        <Copy muted>
          {timezone
            ? "Lựa chọn chỉ thay đổi đồng hồ mẫu ở màn hình này. Các lịch xem thử vẫn theo múi giờ thiết bị; cấu hình tài khoản thật cần API."
            : "Lựa chọn được giữ trong phiên xem thử. Giao diện hiện dùng tiếng Việt; bản dịch English và đồng bộ tùy chọn cần triển khai khi có yêu cầu bản địa hóa."}
        </Copy>
      </Panel>
    </FeaturePage>
  );
}
