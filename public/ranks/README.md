# Rank Images

This folder contains custom rank logo images.

## Rank Logos

Place your rank logo images here with the following naming convention:

### Bronze Rank Logo
- **Filename**: `bronze-rank-logo.png`
- **Path**: `public/ranks/bronze-rank-logo.png`
- The image will automatically be used for all Bronze rank tiers (Bronze 1, Bronze 2, Bronze 3) instead of the default emoji (🥉).

### Gold Rank Logo
- **Filename**: `gold-rank-logo.png`
- **Path**: `public/ranks/gold-rank-logo.png`
- The image will automatically be used for all Gold rank tiers (Gold 1, Gold 2, Gold 3) instead of the default emoji (🥇).

## Image Requirements

- Recommended format: PNG with transparency
- Recommended size: 128x128px or higher (will be scaled as needed)
- The image should have a transparent background for best results

## Adding More Rank Images

To add custom images for other ranks, update the `imageUrl` field in `src/types/ranking.ts` for the desired rank tier.

