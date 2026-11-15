import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useConnectionCommand, useConnections } from "@/features/connections";
import type { ApiMaterial } from "../api/material-contracts";
import type { UploadedFile } from "@/lib/http/file-upload";
import { canEditMaterial } from "../utils/owner-material-presentation";
import {
  materialEditorSchema,
  editorMaterialInput,
  type MaterialEditorValues,
} from "../utils/material-editor-schema";
import { useMaterialsApi } from "./use-materials";
import { useMaterialEditorRecovery } from "./use-material-editor-recovery";

function editorValues(material?: ApiMaterial): MaterialEditorValues {
  return {
    skillId: material?.skillId ?? "",
    title: material?.title ?? "",
    description: material?.description ?? "",
    accessType: material?.accessType ?? "FREE",
    priceCredit: material?.priceCredit ?? "0",
    rights: !!material?.distributionRightsConfirmedAt,
  };
}

export function useMaterialEditor(
  currentMaterial?: ApiMaterial,
  readBlocked = false,
) {
  const api = useMaterialsApi();
  const runtime = useConnections();
  const router = useRouter();
  const command = useConnectionCommand<ApiMaterial>([["materials"]]);
  const recovery = useMaterialEditorRecovery(currentMaterial, command.error);
  const material = recovery.material;
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [coverFiles, setCoverFiles] = useState<UploadedFile[]>([]);
  const [coverBusy, setCoverBusy] = useState(false);
  const form = useForm<MaterialEditorValues>({
    resolver: zodResolver(materialEditorSchema),
    defaultValues: editorValues(material),
  });
  const disabled =
    command.pending ||
    command.uncertain ||
    recovery.loading ||
    !!(material && !canEditMaterial(material)) ||
    !!(currentMaterial && !canEditMaterial(currentMaterial));
  const blocked =
    disabled ||
    readBlocked ||
    recovery.conflict ||
    uploadBusy ||
    coverBusy ||
    files.some((file) => file.state !== "READY") ||
    coverFiles.some((file) => file.state !== "READY");
  const resolveConflict = (keepDraft: boolean) => {
    if (command.pending || command.uncertain || uploadBusy || coverBusy) return;
    const latest = recovery.adopt();
    if (!latest) return;
    if (!keepDraft) {
      form.reset(editorValues(latest));
      setFiles([]);
      setCoverFiles([]);
    }
  };
  const save = form.handleSubmit(async (values) => {
    if (blocked || !runtime.isCurrent()) return;
    const body = editorMaterialInput(values, files[0], coverFiles[0]);
    const saved = await command.run(
      JSON.stringify({
        id: material?.id,
        version: material?.listingVersion,
        body,
      }),
      () =>
        material
          ? api.update(material.id, material.listingVersion, body)
          : api.create(body),
    );
    if (saved && runtime.isCurrent())
      router.replace("/materials/mine?tab=posted");
  });
  return {
    api,
    material,
    recovery,
    resolveConflict,
    runtime,
    form,
    command,
    files,
    setFiles,
    uploadBusy,
    setUploadBusy,
    coverFiles,
    setCoverFiles,
    coverBusy,
    setCoverBusy,
    disabled,
    blocked,
    save,
  };
}
