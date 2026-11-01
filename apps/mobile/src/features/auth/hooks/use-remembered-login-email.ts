import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { LoginFormValues } from "../schemas/auth-schemas";
import { lastLoginEmail } from "../utils/last-login-email";

export function useRememberedLoginEmail(
  {
    getValues,
    setValue,
  }: Pick<UseFormReturn<LoginFormValues>, "getValues" | "setValue">,
  routeEmail: string | undefined,
) {
  const edited = useRef(false);
  useEffect(() => {
    let active = true;
    void lastLoginEmail.load().then((email) => {
      if (
        active &&
        !routeEmail &&
        !edited.current &&
        !getValues("email") &&
        email
      )
        setValue("email", email, { shouldValidate: true });
    });
    return () => {
      active = false;
    };
  }, [getValues, setValue, routeEmail]);

  return (email: string) => {
    edited.current = true;
    lastLoginEmail.remember(email);
  };
}
