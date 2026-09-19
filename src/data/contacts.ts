export interface Contact { id: string; label: string; handle: string; href: string; icon: string; copy?: string }
export const SH_CONTACTS: Contact[] = [
  { id: "linkedin", label: "LinkedIn", handle: "linkedin.com/in/serhii-hordiichuk-bba866173", href: "https://www.linkedin.com/in/serhii-hordiichuk-bba866173", icon: "c-linkedin" },
  { id: "x", label: "X", handle: "@S_Hordiichuk", href: "https://x.com/S_Hordiichuk", icon: "c-x" },
  { id: "facebook", label: "Facebook", handle: "facebook.com/SERHIIH0RDIICHUK", href: "https://www.facebook.com/SERHIIH0RDIICHUK", icon: "c-fb" },
  { id: "reddit", label: "Reddit", handle: "u/Serhii_Hordiichuk", href: "https://www.reddit.com/user/Serhii_Hordiichuk", icon: "c-reddit" },
  { id: "discord", label: "Discord", handle: "@serhii_hordiichuk", href: "https://discord.com/users/294798422496509952", icon: "c-discord", copy: "serhii_hordiichuk" },
  { id: "telegram", label: "Telegram", handle: "t.me/n96689237", href: "https://t.me/n96689237", icon: "c-tg" },
  { id: "gmail", label: "Gmail", handle: "serhiihordiichuk@gmail.com", href: "mailto:serhiihordiichuk@gmail.com", icon: "c-gmail", copy: "serhiihordiichuk@gmail.com" },
  { id: "finn", label: "FINN", handle: "finn.no – id 177031213", href: "https://www.finn.no/profile/ads?userId=177031213", icon: "c-finn" },
  { id: "frilansbasen", label: "Frilansbasen", handle: "frilansbasen.no/frilansere/serhii-hordiichuk", href: "https://frilansbasen.no/frilansere/serhii-hordiichuk", icon: "c-frilans" }
];
