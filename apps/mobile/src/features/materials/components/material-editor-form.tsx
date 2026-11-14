import { Host, Checkbox } from "@expo/ui";
import { Controller } from "react-hook-form";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { ControlledInput } from "@/components/ControlledInput";
import { FormNotice } from "@/components/FormNotice";
import { ServerFilePicker } from "@/components/server-file-picker";
import { appColors } from "@/constants/theme";
import { materialFailure } from "../utils/material-failure";
import type { ApiMaterial } from "../api/material-contracts";
import { useMaterialEditor } from "../hooks/use-material-editor";
import {
  materialFileTypes,
  materialFileFormats,
  prepareMaterialUpload,
} from "../utils/material-upload";
import { MaterialSkillPicker } from "./material-skill-picker";
import { MaterialFieldError } from "./material-field-error";
import { MaterialEditorConflict } from "./material-editor-conflict";
import { materialStyles as styles } from "./material.styles";

export function MaterialEditorForm({
  material: initialMaterial,
}: Readonly<{ material?: ApiMaterial }>) {
  const router = useRouter();
  const {
    api,
    material,
    recovery,
    resolveConflict,
    runtime,
    form,
    command,
    files,
    setFiles,
    setUploadBusy,
    uploadBusy,
    disabled,
    blocked,
    save,
  } = useMaterialEditor(initialMaterial);
  const access = form.watch("accessType");
  return (
    <View style={styles.page}>
      {material?.status === "PUBLISHED" && (
        <FormNotice tone="info" compact>
          Chỉnh sửa sẽ chuyển tài liệu về trạng thái chờ duyệt.
        </FormNotice>
      )}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Thông tin tài liệu</Text>
        <ControlledInput
          control={form.control}
          name="title"
          label="Tên tài liệu"
          required
          placeholder="Ví dụ: Giao tiếp tiếng Anh cơ bản"
          editable={!disabled}
          reserveMessageSpace={false}
        />
        <ControlledInput
          control={form.control}
          name="description"
          label="Mô tả"
          required
          placeholder="Người học sẽ tìm thấy gì trong tài liệu này?"
          multiline
          editable={!disabled}
          reserveMessageSpace={false}
        />
        <MaterialSkillPicker
          value={form.watch("skillId")}
          onChange={(value) =>
            form.setValue("skillId", value, { shouldValidate: true })
          }
          error={form.formState.errors.skillId?.message}
          disabled={disabled}
        />
      </View>
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Tệp đính kèm</Text>
        {!!material?.file && (
          <Text style={styles.meta}>
            Hiện tại: {material.file.originalFilename ?? "Tệp tài liệu"}
          </Text>
        )}
        <ServerFilePicker
          compact
          files={files}
          onChange={setFiles}
          upload={api.upload}
          status={api.fileStatus}
          isCurrent={runtime.isCurrent}
          onBusyChange={setUploadBusy}
          maxCount={1}
          maxBytes={20_000_000}
          types={materialFileTypes}
          formats={materialFileFormats}
          prepareAsset={prepareMaterialUpload}
          disabled={disabled}
        />
        {!material?.file && !files.length && (
          <Text style={styles.caption}>
            Bạn có thể lưu nháp và thêm tệp sau.
          </Text>
        )}
      </View>
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Cách chia sẻ</Text>
        <View style={styles.choices}>
          {(["FREE", "PAID"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={
                value === "FREE" ? "Chia sẻ miễn phí" : "Chia sẻ có phí"
              }
              accessibilityState={{ checked: access === value, disabled }}
              disabled={disabled}
              onPress={() => {
                if (access === value) return;
                form.setValue("accessType", value, { shouldValidate: true });
                form.setValue("priceCredit", value === "FREE" ? "0" : "", {
                  shouldValidate: false,
                });
              }}
              style={[styles.choice, access === value && styles.activeChoice]}
            >
              <Text style={styles.title}>
                {value === "FREE" ? "Miễn phí" : "Trả phí"}
              </Text>
              <Text style={styles.meta}>
                {value === "FREE"
                  ? "Cùng nhau học tập"
                  : "Thanh toán bằng Credit"}
              </Text>
            </Pressable>
          ))}
        </View>
        {access === "PAID" && (
          <ControlledInput
            control={form.control}
            name="priceCredit"
            label="Giá Credit"
            required
            placeholder="Ví dụ: 25"
            keyboardType="decimal-pad"
            normalizeText={(value) => value.replace(",", ".")}
            editable={!disabled}
            reserveMessageSpace={false}
            hint="Tối đa 2 chữ số thập phân."
          />
        )}
        <Controller
          control={form.control}
          name="rights"
          render={({ field, fieldState }) => (
            <View style={styles.section}>
              <Host
                matchContents={{ vertical: true }}
                seedColor={appColors.primary}
                style={styles.nativeControl}
              >
                <Checkbox
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                  label="Tôi có quyền phân phối nội dung này"
                />
              </Host>
              <MaterialFieldError message={fieldState.error?.message} />
            </View>
          )}
        />
      </View>
      {form.formState.submitCount > 0 &&
        Object.keys(form.formState.errors).length > 0 && (
          <FormNotice tone="error" compact>
            <Text style={styles.title}>Chưa thể lưu tài liệu</Text>
            {"\n"}Kiểm tra các mục được đánh dấu phía trên rồi thử lại.
          </FormNotice>
        )}
      <MaterialEditorConflict
        recovery={recovery}
        resolveConflict={resolveConflict}
        busy={uploadBusy || command.pending || command.uncertain}
      />
      {!!command.error &&
        !command.uncertain &&
        !recovery.conflict &&
        !recovery.handledError && (
          <FormNotice tone="error" compact>
            {materialFailure(command.error)}
          </FormNotice>
        )}
      {command.uncertain && (
        <>
          <FormNotice tone="warning" compact>
            Chưa xác nhận được kết quả lưu. Kiểm tra danh sách trước khi gửi
            lại.
          </FormNotice>
          <Button
            variant="paper"
            onPress={() => router.push("/materials/mine")}
          >
            Kiểm tra tài liệu đã lưu
          </Button>
        </>
      )}
      <Button
        variant="craft"
        leadingIcon="check"
        disabled={blocked || form.formState.isSubmitting}
        onPress={() => void save()}
      >
        {command.pending
          ? "Đang lưu…"
          : !material || ["DRAFT", "REJECTED"].includes(material.status)
            ? "Lưu bản nháp"
            : "Lưu thay đổi"}
      </Button>
      <Text style={styles.caption}>
        Lưu thông tin trước, sau đó gửi duyệt trong Tài liệu của tôi.
      </Text>
    </View>
  );
}
