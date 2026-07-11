type IconProps = { className?: string };

const defaults = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function MoreIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></svg>;
}

export function CameraIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...defaults}><path d="M8.2 6.5 9.5 4.8h5l1.3 1.7H19a2 2 0 0 1 2 2v8.7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.2Z" /><circle cx="12" cy="12.8" r="3.6" /></svg>;
}

export function PlusIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...defaults} strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>;
}

export function SearchIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...defaults}><circle cx="10.7" cy="10.7" r="6.7" /><path d="m15.6 15.6 4.3 4.3" /></svg>;
}

export function UpdatesIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 28 28" aria-hidden="true" {...defaults}><path d="M5.4 7.2A11 11 0 0 1 21 6.8M22.6 20.8A11 11 0 0 1 7 21.2" /><path d="m4.7 3 .7 4.2 4-.8M23.3 25l-.7-4.2-4 .8" /><circle cx="14" cy="14" r="6.2" /></svg>;
}

export function CallsIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 28 28" aria-hidden="true" {...defaults} strokeWidth="2"><path d="M7.4 3.7 4.2 6.3c-.8.7-.8 1.8-.5 2.8 2.7 7.4 7.8 12.5 15.2 15.2 1 .3 2.1.3 2.8-.5l2.6-3.2c.6-.7.5-1.7-.2-2.3l-4-3c-.7-.5-1.6-.4-2.2.2l-1.8 1.9a17.5 17.5 0 0 1-5.5-5.5l1.9-1.8c.6-.6.7-1.5.2-2.2l-3-4c-.6-.7-1.6-.8-2.3-.2Z" /></svg>;
}

export function CommunitiesIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 28 28" aria-hidden="true" {...defaults}><circle cx="14" cy="8" r="3.2" /><circle cx="5.8" cy="11" r="2.4" /><circle cx="22.2" cy="11" r="2.4" /><path d="M7.8 22v-2.2c0-3.2 2.8-5.7 6.2-5.7s6.2 2.5 6.2 5.7V22H7.8ZM2.2 21v-1.4c0-2.6 1.8-4.5 4.2-4.5M25.8 21v-1.4c0-2.6-1.8-4.5-4.2-4.5" /></svg>;
}

export function ChatsIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 28 28" aria-hidden="true"><path d="M14.2 4C7.9 4 3 8 3 13c0 2.3 1 4.4 2.8 6l-1.2 4.5 5-2.3c1.4.5 3 .8 4.6.8 6.3 0 11.3-4 11.3-9S20.5 4 14.2 4Z" fill="currentColor" /></svg>;
}

export function UserIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 28 28" aria-hidden="true" {...defaults}><circle cx="14" cy="14" r="11" /><circle cx="14" cy="10.5" r="3.6" /><path d="M6.7 22.1c1.5-3 4.2-4.8 7.3-4.8s5.8 1.8 7.3 4.8" /></svg>;
}

export function MetaAiIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="meta-ai" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse"><stop stopColor="#fb4fd8"/><stop offset=".45" stopColor="#8457ff"/><stop offset="1" stopColor="#2b83ff"/></linearGradient></defs><path d="M24 8c2.8 5.2 5.7 8.2 12 8-5.2 2.8-8.2 5.7-8 12-2.8-5.2-5.7-8.2-12-8 5.2-2.8 8.2-5.7 8-12Z" fill="url(#meta-ai)"/><path d="M13 24c1.9 3.5 3.8 5.5 8 5.4-3.5 1.9-5.5 3.8-5.4 8-1.9-3.5-3.8-5.5-8-5.4 3.5-1.9 5.5-3.8 5.4-8ZM34 26c1.5 2.8 3 4.3 6.3 4.2-2.8 1.5-4.3 3-4.2 6.3-1.5-2.8-3-4.3-6.3-4.2 2.8-1.5 4.3-3 4.2-6.3Z" fill="url(#meta-ai)"/></svg>;
}

export function CheckmarksIcon({ color = "#8e8e93" }: { color?: string }) {
  return <svg className="ios-preview-icon" viewBox="0 0 20 14" aria-hidden="true"><path d="m1 7 4 4L13 2M7 7l4 4 8-9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function MicSmallIcon() {
  return <svg className="ios-preview-icon" viewBox="0 0 16 16" aria-hidden="true" {...defaults} stroke="#25d366"><rect x="5.2" y="1.5" width="5.6" height="8.5" rx="2.8"/><path d="M3.5 7.8a4.5 4.5 0 0 0 9 0M8 12.3v2.2"/></svg>;
}

export function CameraSmallIcon() {
  return <svg className="ios-preview-icon" viewBox="0 0 18 16" aria-hidden="true" {...defaults}><path d="M6 4 7 2.5h4L12 4h2.5A1.5 1.5 0 0 1 16 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 2 12.5v-7A1.5 1.5 0 0 1 3.5 4H6Z"/><circle cx="9" cy="8.8" r="2.7"/></svg>;
}

export function BackIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...defaults} strokeWidth="2.8"><path d="m15.5 4-8 8 8 8" /></svg>;
}

export function VideoIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 28 28" aria-hidden="true" {...defaults} strokeWidth="2"><rect x="3" y="6" width="15" height="16" rx="3"/><path d="m18 11 6-4v14l-6-4" /></svg>;
}

export function PhoneIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 28 28" aria-hidden="true" {...defaults} strokeWidth="2.2"><path d="M8 4.2 5.1 6.6c-.7.6-.8 1.6-.5 2.5 2.1 6.2 6.5 10.6 12.7 12.7.9.3 1.9.2 2.5-.5l2.4-2.9c.5-.6.4-1.5-.2-2l-3.5-2.6c-.6-.4-1.4-.3-1.9.2l-1.7 1.8a15 15 0 0 1-5.1-5.1l1.8-1.7c.5-.5.6-1.3.2-1.9L10 4.4c-.5-.6-1.4-.7-2-.2Z" /></svg>;
}

export function AttachmentIcon() {
  return <svg viewBox="0 0 28 28" aria-hidden="true" {...defaults} strokeWidth="2.2"><path d="M14 3v22M3 14h22" /></svg>;
}

export function StickerIcon() {
  return <svg viewBox="0 0 28 28" aria-hidden="true" {...defaults}><path d="M5 3h18a2 2 0 0 1 2 2v11.5A8.5 8.5 0 0 1 16.5 25H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M25 16.5h-5a3.5 3.5 0 0 0-3.5 3.5v5" /></svg>;
}

export function CameraChatIcon() {
  return <svg viewBox="0 0 30 28" aria-hidden="true" {...defaults} strokeWidth="2.1"><path d="m10 5 1.5-2h7L20 5h4.5A2.5 2.5 0 0 1 27 7.5v14a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 3 21.5v-14A2.5 2.5 0 0 1 5.5 5H10Z"/><circle cx="15" cy="14.5" r="5"/></svg>;
}

export function MicrophoneIcon() {
  return <svg viewBox="0 0 28 28" aria-hidden="true" {...defaults} strokeWidth="2.2"><rect x="10" y="3" width="8" height="14" rx="4"/><path d="M6.5 13.5a7.5 7.5 0 0 0 15 0M14 21v4"/></svg>;
}

export function SendIcon() {
  return <svg viewBox="0 0 28 28" aria-hidden="true"><path fill="currentColor" d="M3 4.2 25.4 14 3 23.8l1.7-7L16 14 4.7 11.2 3 4.2Z" /></svg>;
}
