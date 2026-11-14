export type AvailableSection<T> = {
  availability: "AVAILABLE";
  data: T;
};

export type UnavailableSection = {
  availability: "UNAVAILABLE";
  errorCode: string;
};

export type AdminSection<T> = AvailableSection<T> | UnavailableSection;

export const available = <T>(data: T): AvailableSection<T> => ({
  availability: "AVAILABLE",
  data,
});

export const unavailable = (errorCode: string): UnavailableSection => ({
  availability: "UNAVAILABLE",
  errorCode,
});
