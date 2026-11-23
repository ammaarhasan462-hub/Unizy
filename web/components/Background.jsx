// Fixed backdrop: fine grid and three soft colour fields. Static on purpose: the old version blurred the fields with a
// 120px filter, moved them on every scroll frame and blended film grain over the whole screen, which made scrolling the
// homepage stutter on slower laptops (about 10 fps with the CPU slowed 6x). Soft radial gradients look the same and are
// painted once. Hidden in the simple version (html.lite, see lib/boot.js).
export default function Background() {
  return (
    <div className="site-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="bg-grid absolute inset-x-0 top-0 h-[130vh]" />
      <div className="glow-soft glow-a left-[-10%] top-[-12%] size-[620px]" />
      <div className="glow-soft glow-b right-[-12%] top-[8%] size-[560px]" />
      <div className="glow-soft glow-c bottom-[-20%] left-[30%] size-[520px]" />
    </div>
  );
}
