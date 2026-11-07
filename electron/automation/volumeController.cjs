const { runPowerShell } = require('./psHelper.cjs');

const CORE_AUDIO_SCRIPT = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out uint pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    int Activate(ref Guid id, int clsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject { }

public class AudioController {
    private static IAudioEndpointVolume GetEndpoint() {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev = null;
        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
        var IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        object epv;
        dev.Activate(ref IID_IAudioEndpointVolume, 23, IntPtr.Zero, out epv);
        return (IAudioEndpointVolume)epv;
    }

    public static float GetVolume() {
        var ep = GetEndpoint();
        float vol;
        ep.GetMasterVolumeLevelScalar(out vol);
        return vol;
    }

    public static void SetVolume(float level) {
        var ep = GetEndpoint();
        ep.SetMasterVolumeLevelScalar(level, Guid.Empty);
    }

    public static bool GetMute() {
        var ep = GetEndpoint();
        bool mute;
        ep.GetMute(out mute);
        return mute;
    }

    public static void SetMute(bool mute) {
        var ep = GetEndpoint();
        ep.SetMute(mute, Guid.Empty);
    }
}
'@
`;

class VolumeController {
  constructor(run = runPowerShell) {
    this.runPowerShell = run;
  }

  async getVolume() {
    try {
      const psCommand = `${CORE_AUDIO_SCRIPT}
$v = [math]::Round([AudioController]::GetVolume() * 100)
$m = [AudioController]::GetMute()
Write-Output "$v|$m"
`;
      const { stdout } = await this.runPowerShell(psCommand);
      const snapshot = stdout.trim().match(/^(0|[1-9]\d?|100)\|(true|false)$/i);
      if (!snapshot) throw new Error('Windows returned an invalid volume or mute state');
      return {
        success: true,
        volume: Number(snapshot[1]),
        muted: snapshot[2].toLowerCase() === 'true',
        verified: true
      };
    } catch (err) {
      console.error('Failed to get volume:', err.message);
      return { success: false, volume: null, muted: null, verified: false, error: err.message };
    }
  }

  async setVolume(percentage) {
    try {
      if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        throw new Error('Volume must be a number between 0 and 100');
      }
      const clamped = Math.round(percentage);
      const scalar = (clamped / 100).toFixed(2);
      const psCommand = `${CORE_AUDIO_SCRIPT}
[AudioController]::SetVolume(${scalar})
[AudioController]::SetMute($false)
$v = [math]::Round([AudioController]::GetVolume() * 100)
Write-Output "$v"
`;
      const { stdout } = await this.runPowerShell(psCommand);
      const value = stdout.trim();
      const verifiedVol = /^(0|[1-9]\d?|100)$/.test(value) ? Number(value) : null;
      const ok = verifiedVol !== null && Math.abs(verifiedVol - clamped) <= 2;
      return {
        success: ok,
        volume: verifiedVol,
        message: ok ? `System volume set to ${verifiedVol}%` : 'Windows volume change could not be verified.',
        error: ok ? undefined : 'Could not verify the requested system volume.',
        verified: ok
      };
    } catch (err) {
      return {
        success: false,
        error: `Could not set volume: ${err.message}`,
        verified: false
      };
    }
  }

  async changeVolume(delta) {
    try {
      if (typeof delta !== 'number' || !Number.isFinite(delta) || delta < -100 || delta > 100) {
        throw new Error('Volume adjustment must be between -100 and 100');
      }
      const current = await this.getVolume();
      if (!current.success || !current.verified || typeof current.volume !== 'number') {
        return { success: false, verified: false, error: 'Cannot change volume: current system volume could not be read.' };
      }
      const target = Math.max(0, Math.min(100, current.volume + delta));
      return await this.setVolume(target);
    } catch (err) {
      return { success: false, error: err.message, verified: false };
    }
  }

  async setMute(mute) {
    try {
      if (typeof mute !== 'boolean') throw new Error('Mute must be true or false');
      const muteArg = mute ? '$true' : '$false';
      const psCommand = `${CORE_AUDIO_SCRIPT}
[AudioController]::SetMute(${muteArg})
$m = [AudioController]::GetMute()
Write-Output "$m"
`;
      const { stdout } = await this.runPowerShell(psCommand);
      const response = stdout.trim().toLowerCase();
      if (response !== 'true' && response !== 'false') {
        return { success: false, verified: false, error: 'Windows mute status could not be read.' };
      }
      const isMuted = response === 'true';
      const verified = isMuted === mute;
      return {
        success: verified,
        muted: isMuted,
        message: verified ? (isMuted ? 'System audio muted' : 'System audio unmuted') : 'Requested mute state was not applied.',
        error: verified ? undefined : 'System mute state does not match the requested value.',
        verified
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to toggle mute: ${err.message}`,
        verified: false
      };
    }
  }
}

module.exports = new VolumeController();
module.exports.VolumeController = VolumeController;
