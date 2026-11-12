const phoneOrVirtual = /\bphone\b|android|iphone|droidcam|iriun|epoccam|camo\b|virtual|continuity|\bobs\b/i;
export function preferredDevice(devices, kind, saved = '') {
  const inputs = devices.filter(device => device.kind === kind && device.deviceId && !['default', 'communications'].includes(device.deviceId));
  const selected = inputs.find(device => device.deviceId === saved);
  if (selected && (kind !== 'videoinput' || selectableCamera(selected))) return selected;
  const local = inputs.filter(device => !phoneOrVirtual.test(device.label));
  if (kind === 'videoinput') return local.find(device => /integrated|built.?in|internal|laptop|easycamera|facetime/i.test(device.label) && !/\bir\b|infrared/i.test(device.label)) || null;
  return local.find(device => /microphone array|built.?in|internal|cirrus|realtek/i.test(device.label)) || local.find(device => device.label) || null;
}
export function selectableCamera(device) { return device.kind === 'videoinput' && !phoneOrVirtual.test(device.label) && !/\bir\b|infrared/i.test(device.label); }
export function inputConstraints(id) { return { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, ...(id && { deviceId: { exact: id } }) }; }
