import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const light = readFileSync(new URL('../src/lightTheme.css', import.meta.url), 'utf8');
const dark = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const accessibility = readFileSync(new URL('../src/accessibility.css', import.meta.url), 'utf8');
const interfaceDesign = readFileSync(new URL('../src/uiDesign.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function colour(css: string, selector: string, property: string): string {
  const rule = css.split('}').find(rule => rule.trim().startsWith(`${selector} {`));
  const value = rule?.match(new RegExp(`(?:^|[;{])\\s*${property}:\\s*(#[0-9a-f]{6})\\b`))?.[1];
  assert.ok(value, `Missing ${property} in ${selector}`);
  return value;
}

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map(start => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + .05) / (values[1]! + .05);
}

test('shared action, selected-state and helper colours meet AA in both themes', () => {
  for (const selector of [':root', ":root[data-theme='light']"]) {
    const token = (name: string) => colour(interfaceDesign, selector, `--ui-${name}`);
    for (const [foreground, background] of [
      ['primary-ink', 'primary'], ['primary-ink', 'primary-hover'],
      ['selected-ink', 'selected'], ['ink', 'surface'], ['muted', 'surface'],
    ]) {
      const ratio = contrast(token(foreground!), token(background!));
      assert.ok(ratio >= 4.5, `${selector} ${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
    }
    assert.ok(contrast(token('border'), token('surface')) >= 3, `${selector} control boundary`);
  }
});

test('creative personality text meets WCAG AA in each theme', () => {
  for (const [css, prefix, background] of [
    [light, "[data-theme='light'] ", '#f8faf4'],
    [dark, '', colour(dark, '#ability-designer', 'background')],
  ]) {
    for (const selector of ['.artist-designer label', '.artist-designer p', '.artist-designer .artist-note']) {
      const ratio = contrast(colour(css!, prefix + selector, 'color'), background!);
      assert.ok(ratio >= 4.5, `${prefix}${selector}: ${ratio.toFixed(2)}:1`);
    }
  }
});

test('creative selects retain readable text and visible boundaries', () => {
  for (const [css, selector, surface] of [
    [light, "[data-theme='light'] .artist-designer select", '#f8faf4'],
    [dark, '.artist-designer select', '#112729'],
  ]) {
    const background = colour(css!, selector!, 'background');
    assert.ok(contrast(colour(css!, selector!, 'color'), background) >= 4.5);
    const border = css!.split('}').find(rule => rule.trim().startsWith(`${selector} {`))!.match(/(?:border-color:\s*|border:\s*1px solid\s*)(#[0-9a-f]{6})/)![1]!;
    assert.ok(contrast(border, background) >= 3);
    assert.ok(contrast(border, surface!) >= 3);
  }
});

test('light keyboard focus and slider track contrast exceed 3:1', () => {
  const focus = colour(accessibility, "[data-theme='light'] :is(a, button, input, select, summary):focus-visible", 'outline-color');
  const track = colour(light, "[data-theme='light'] input[type='range']::-webkit-slider-runnable-track", 'background');
  for (const surface of ['#f8faf4', '#eef2eb', '#e9efe8', '#e1ebe4']) {
    assert.ok(contrast(focus, surface) >= 3);
    assert.ok(contrast(track, surface) >= 3);
  }
});
