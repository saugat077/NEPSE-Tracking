/** Page header: title + muted note + action (pages are top-level in the sidebar shell). */
export default function PageHeader({ title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.3px]">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-[12.5px] text-[color:var(--muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
