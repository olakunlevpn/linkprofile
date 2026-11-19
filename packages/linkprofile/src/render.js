import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { isRemote } from './validate.js';
import { getSocialIcon, getLinkIcon, getThemeIcon } from './icons.js';
import { isDarkColor } from './color.js';

const partialsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'partials');
const blank = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

export function buildContext(profile, theme, { version = 'dev' } = {}) {
  const base = profile.url;
  const absolute = (local) => (base ? new URL(local, `${base}/`).href : null);
  const image = profile.avatar ? (isRemote(profile.avatar) ? profile.avatar : absolute(profile.avatar)) : null;
  return {
    profile: {
      name: profile.name,
      bio: blank(profile.bio),
      links_title: blank(profile.links_title),
      avatar_url: profile.avatar,
      socials: profile.socials.map((s) => ({ type: s.type, url: s.url, label: blank(s.label), svg: getSocialIcon(s.type)?.svg ?? '' })),
      links: profile.links.map((l) => {
        const icon = l.icon ? String(l.icon).toLowerCase() : null;
        return {
          title: l.title,
          url: l.url,
          external: l.external,
          icon,
          icon_svg: icon ? getLinkIcon(icon) : null,
          theme_icon_svg: icon ? getThemeIcon(theme.dir, icon) : null,
          image_url: l.image,
          color: l.color,
          color_is_dark: l.color ? isDarkColor(l.color) : false,
        };
      }),
    },
    theme: { name: theme.name, options: { ...theme.options, ...profile.theme.options } },
    page: {
      title: blank(profile.meta.title),
      description: blank(profile.meta.description),
      canonical: base ? `${base}/` : null,
      image,
      favicon_url: profile.meta.favicon,
      generator: `linkprofile ${version}`,
    },
  };
}

export async function renderPage(profile, theme, opts = {}) {
  const engine = new Liquid({
    root: [partialsDir, theme.dir],
    extname: '.liquid',
    outputEscape: 'escape',
    strictFilters: true,
  });
  return engine.renderFile('template', buildContext(profile, theme, opts));
}
