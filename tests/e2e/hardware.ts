// Ayudante de las pruebas de extremo a extremo: activar o quitar la marca de ciclo como en la CPU real.
// Explorador ▸ Equipo(1) ▸ doble clic en Hardware ▸ doble clic en la CPU ▸ Ciclo/Marca de ciclo ▸ Aceptar ▸
// Guardar y compilar ▸ Cargar en módulo (acepta pasar a STOP y volver a RUN) ▸ cerrar.
import { expect, type Page } from '@playwright/test';

export async function marcaCiclo(win: Page, activa: boolean, byte = 0) {
  const aceptar = (d: { accept: () => Promise<void> }) => { void d.accept(); };
  win.on('dialog', aceptar);
  await win.locator('.ex-hw').dblclick();
  const hw = win.locator('.vflot.hwc');
  await expect(hw).toHaveCount(1);
  await hw.locator('.hwc-tabla tr', { hasText: 'CPU compacta' }).dblclick();
  await win.locator('.hwp-tab', { hasText: 'Ciclo/Marca de ciclo' }).click();
  const casilla = win.locator('.modal label.check', { hasText: 'Marca de ciclo' }).locator('input');
  if (activa) {
    await casilla.check();
    await win.locator('.modal input[aria-label="Byte de marcas"]').fill(String(byte));
  } else await casilla.uncheck();
  await win.locator('.modal-foot button', { hasText: 'Aceptar' }).click();
  await hw.locator('button[aria-label="Guardar y compilar"]').click();
  await expect(hw.locator('.hwc-estado')).toContainText('Falta cargarlo');
  await hw.locator('button[aria-label="Cargar en módulo"]').click();
  await expect(hw.locator('.hwc-estado')).toContainText('cargada en la CPU');
  await hw.locator('.vflot-head button[aria-label="Cerrar"]').click();
  await expect(hw).toHaveCount(0);
  win.off('dialog', aceptar);
}
