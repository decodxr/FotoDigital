/** Pure scroll/pose math shared by the stage and regression tests. */
export const cameraChapters = [
    { label: 'O olhar', title: 'Tudo começa com um olhar.', text: 'Antes do clique, existe uma escolha: o que merece ficar? Um gesto, a luz de uma tarde, alguém que faz parte da sua história.' },
    { label: 'Os detalhes', title: 'A beleza mora nos detalhes.', text: 'No relevo do couro. No metal marcado pelo tempo. Na luz que atravessa a lente. A fotografia sempre foi uma arte de perceber.' },
    { label: 'A memória', title: 'Um instante. Para sempre perto.', text: 'Desde 2003, a FOTO DIGITAL dá forma às suas lembranças. Porque algumas histórias merecem muito mais do que uma tela.' },
] as const;
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const chapterAt = (progress: number) => Math.min(2, Math.floor(clamp01(progress) * 3));
export function scrollProgress(top: number, height: number, stageHeight: number, inset: number, viewportHeight = stageHeight) {
    const travel = height - stageHeight;
    // Short screens use natural document flow instead of a pinned panel.
    // Keep rotation continuous across that section's passage through the viewport.
    return travel > 1
        ? clamp01((inset - top) / travel)
        : clamp01((viewportHeight - top) / Math.max(1, height + viewportHeight - inset));
}
export function cameraPose(progress: number) {
    const p = clamp01(progress);
    return { yaw: -0.42 + p * Math.PI * 2, pitch: 0.13 + Math.sin(p * Math.PI * 2) * 0.08, roll: -0.055 + Math.sin(p * Math.PI * 2) * 0.025, scale: 1 + Math.sin(p * Math.PI) * 0.1 };
}
