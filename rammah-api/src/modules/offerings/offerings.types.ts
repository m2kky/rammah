export type PublicOffering = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  offeringType: string;
  attendanceMode: string;
  bookingMode: string;
  schedulingMode: "appointment" | "scheduled_program";
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  capacity: number;
  requiresPayment: boolean;
  quoteOnly: boolean;
  colors: {
    background: string;
    text: string;
  };
};
