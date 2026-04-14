export default function Footer() {
  return (
    <footer className="text-center text-xs text-neutral-500 py-8 mt-12 border-t border-neutral-300">
      <p className="mb-2">&copy; {new Date().getFullYear()} aaron williams</p>
      <div className="flex justify-center gap-4">
        <a href="https://x.com/aaaronwill" className="no-underline !text-neutral-500 hover:!text-neutral-700">
          twitter
        </a>
        <a href="https://github.com/aaronw122" className="no-underline !text-neutral-500 hover:!text-neutral-700">
          github
        </a>
        <a
          href="https://www.linkedin.com/in/aaron-williams-91429a1a6/"
          className="no-underline !text-neutral-500 hover:!text-neutral-700"
        >
          linkedin
        </a>
      </div>
    </footer>
  );
}
