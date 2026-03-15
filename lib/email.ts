import nodemailer from "nodemailer";

type DeliveryInput = {
  editionDate: string;
  recipientEmail: string;
  senderEmail: string;
  epub: Buffer;
};

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendEditionEmail(input: DeliveryInput): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    throw new Error("SMTP is not configured.");
  }

  await transport.sendMail({
    from: input.senderEmail,
    to: input.recipientEmail,
    subject: `Kindle News Daily Digest ${input.editionDate}`,
    text: `Attached is your Kindle digest for ${input.editionDate}.`,
    attachments: [
      {
        filename: `kindle-news-${input.editionDate}.epub`,
        content: input.epub,
        contentType: "application/epub+zip"
      }
    ]
  });
}
