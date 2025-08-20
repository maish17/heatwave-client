import clsx from "clsx";
import type { FC, MouseEventHandler } from "react";

type Brand = { label: string; href: string };
type NavLink = {
  label: string;
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export interface NavbarProps {
  brand?: Brand;
  links?: NavLink[];
  className?: string;
}

const defaultBrand: Brand = { label: "Heatwave", href: "/" };
const defaultLinks: NavLink[] = [
  { label: "About", href: "/" },
  { label: "Contact", href: "/" },
  { label: "Donate", href: "/" },
];

const Navbar: FC<NavbarProps> = ({
  brand = defaultBrand,
  links = defaultLinks,
  className = "",
}) => (
  <nav
    className={clsx(
      "flex items-center justify-between px-6 py-4 bg-tan text-text",
      className
    )}
    role="navigation"
    aria-label="Main navigation"
  >
    <div className="text-3xl font-extrabold tracking-wider font-gothic">
      <a
        href={brand.href}
        className="hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-light"
      >
        {brand.label}
      </a>
    </div>

    <ul className="flex space-x-4" role="menubar">
      {links.map(({ label, href, onClick }) => (
        <li key={href + label} role="none">
          <a
            href={href}
            onClick={onClick}
            role="menuitem"
            className="font-hyper hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-light"
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);

export default Navbar;
