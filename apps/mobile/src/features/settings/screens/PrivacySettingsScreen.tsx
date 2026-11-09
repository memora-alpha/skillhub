import { useRouter } from "expo-router";
import { ActionRow } from "@/components/ActionGroup";
import { SettingsPage } from "../components/SettingsPage";
import {
  SettingsIntro,
  SettingsSection,
  SettingsNote,
  SettingsFact,
} from "../components/SettingsUI";

export function PrivacySettingsScreen({
  userId,
}: Readonly<{ userId: string }>) {
  const router = useRouter();
  return (
    <SettingsPage title="Quyền riêng tư">
      <SettingsIntro
        title="Hiểu rõ điều bạn chia sẻ"
        description="Xem thông tin nào công khai và quản lý những gì xuất hiện trên hồ sơ."
      />
      <SettingsSection title="Cộng đồng có thể thấy">
        <SettingsFact icon="user" label="Hồ sơ công khai">
          Tên, ảnh đại diện, giới thiệu và danh hiệu.
        </SettingsFact>
        <SettingsFact icon="award" label="Kỹ năng & hoạt động">
          Kỹ năng đang hiển thị, trạng thái xác minh, uy tín và thống kê công
          khai.
        </SettingsFact>
        <ActionRow
          icon="eye"
          label="Xem trước hồ sơ công khai"
          description="Xem hồ sơ như một người khác"
          onPress={() =>
            router.push({ pathname: "/profiles/[userId]", params: { userId } })
          }
        />
      </SettingsSection>
      <SettingsSection title="Thông tin được giữ riêng tư">
        <SettingsFact icon="lock" label="Tài khoản & thanh toán">
          Email đăng nhập, thông tin xác thực và dữ liệu thanh toán.
        </SettingsFact>
        <SettingsFact icon="file" label="Bằng chứng & tệp riêng tư">
          Bằng chứng xác minh và tệp tài liệu riêng tư không xuất hiện trên hồ
          sơ công khai.
        </SettingsFact>
      </SettingsSection>
      <SettingsSection title="Bạn có thể quản lý">
        <ActionRow
          icon="book"
          label="Hiển thị kỹ năng"
          description="Chọn kỹ năng xuất hiện trên hồ sơ"
          onPress={() => router.push("/my-skills")}
        />
        <ActionRow
          icon="shield"
          label="Chính sách bảo mật"
          description="Tìm hiểu cách SkillHub bảo vệ dữ liệu"
          onPress={() => router.push("/policies")}
        />
      </SettingsSection>
      <SettingsNote>
        Chỉ chia sẻ thông tin bạn muốn người khác nhìn thấy. Bạn có thể sửa phần
        giới thiệu và ảnh trong Hồ sơ.
      </SettingsNote>
    </SettingsPage>
  );
}
