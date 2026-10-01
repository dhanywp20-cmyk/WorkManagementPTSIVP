import type { MetadataRoute } from 'next';

/** Platform internal - tidak untuk diindeks mesin pencari. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
