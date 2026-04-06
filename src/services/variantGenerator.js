/**
 * variantGenerator.js (Frontend Version)
 *
 * Auto-generate product variants from minimal input for preview and bulk creation.
 * This is the frontend counterpart to the backend variantGenerator service.
 *
 * Usage:
 *   import { previewVariants, generateVariants } from './variantGenerator';
 *   const preview = previewVariants({ name, brand, colors, sizes, minPrice, stock });
 */

import { generateSKU } from '../lib/skuGenerator';

/**
 * Normalize a size string (trim, uppercase if numeric)
 */
function normalizeSize(size) {
  const s = String(size).trim();
  // If it's a numeric size, keep it as-is
  if (/^\d+$/.test(s)) return s;
  // Otherwise uppercase text sizes
  return s.toUpperCase();
}

/**
 * Generate variant definitions from minimal product info
 * @param {object} product - Base product definition
 * @returns {object[]} Array of variant definitions
 */
function generateVariantDefinitions(product) {
  const {
    name = '',
    brand = '',
    subType = '',
    colors = [],
    sizes = [],
    minPrice = 0,
    stock = 0,
    category = '',
    topType = 'shoes',
    distributeStock = false,
    photoUrl = '',
  } = product;

  // Normalize colors and sizes
  const normalizedColors = colors.map(c => String(c).trim()).filter(Boolean);
  const normalizedSizes = sizes.map(s => normalizeSize(s)).filter(Boolean);

  if (!normalizedColors.length || !normalizedSizes.length) {
    // If no colors or sizes, create a single "default" variant
    return [{
      name: name.trim(),
      brand: brand || '',
      subType: subType || '',
      color: 'Default',
      size: 'One Size',
      sku: null,
      minPrice: parseFloat(minPrice) || 0,
      stock: parseInt(stock) || 0,
      category: category || '',
      topType: topType || 'shoes',
      photoUrl: photoUrl || '',
    }];
  }

  // Generate all combinations
  const variants = [];
  const stockPerVariant = distributeStock
    ? Math.floor(parseInt(stock) / (normalizedColors.length * normalizedSizes.length))
    : parseInt(stock);

  for (const color of normalizedColors) {
    for (const size of normalizedSizes) {
      variants.push({
        name: name.trim(),
        brand: brand || '',
        subType: subType || '',
        color: color,
        size: size,
        sku: null, // Will be generated
        minPrice: parseFloat(minPrice) || 0,
        stock: stockPerVariant,
        category: category || '',
        topType: topType || 'shoes',
        photoUrl: photoUrl || '',
      });
    }
  }

  // If distributing stock, handle remainder
  if (distributeStock && stockPerVariant > 0) {
    const totalAllocated = stockPerVariant * variants.length;
    let remainder = parseInt(stock) - totalAllocated;
    let idx = 0;
    while (remainder > 0 && idx < variants.length) {
      variants[idx].stock += 1;
      remainder--;
      idx++;
    }
  }

  return variants;
}

/**
 * Preview variants without database lookup (for UI preview)
 * Generates SKUs without uniqueness check
 * @param {object} product - Base product definition
 * @returns {object[]} Variant definitions with generated SKUs
 */
export function previewVariants(product) {
  const definitions = generateVariantDefinitions(product);

  return definitions.map(variant => ({
    ...variant,
    sku: generateSKU({
      brand: variant.brand,
      subType: variant.subType,
      color: variant.color,
      size: variant.size,
    }),
  }));
}

/**
 * Generate variants with SKUs (frontend version - no DB uniqueness check)
 * For actual unique SKU generation, use the backend bulk-create endpoint
 * @param {object} product - Base product definition
 * @returns {object[]} Variant definitions with generated SKUs
 */
export function generateVariants(product) {
  return previewVariants(product);
}

/**
 * Validate variant input before generation
 * @param {object} product - Base product definition
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateProductInput(product) {
  const errors = [];
  const warnings = [];

  if (!product.name || !product.name.trim()) {
    errors.push('Product name is required');
  }

  if (!product.brand || !product.brand.trim()) {
    errors.push('Brand name is required');
  }

  if (!product.minPrice || parseFloat(product.minPrice) <= 0) {
    errors.push('Minimum price must be greater than 0');
  }

  if (!product.colors || product.colors.length === 0) {
    warnings.push('No colors specified — a single "Default" variant will be created');
  }

  if (!product.sizes || product.sizes.length === 0) {
    warnings.push('No sizes specified — a single "One Size" variant will be created');
  }

  if (product.stock && parseInt(product.stock) < 0) {
    errors.push('Stock cannot be negative');
  }

  if (product.colors && product.colors.length > 20) {
    warnings.push(`Large number of colors (${product.colors.length}) — this will create many variants`);
  }

  if (product.sizes && product.sizes.length > 20) {
    warnings.push(`Large number of sizes (${product.sizes.length}) — this will create many variants`);
  }

  if (product.colors && product.sizes) {
    const totalVariants = product.colors.length * product.sizes.length;
    if (totalVariants > 100) {
      warnings.push(`This will create ${totalVariants} variants — consider splitting into smaller batches`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export default { previewVariants, generateVariants, validateProductInput };