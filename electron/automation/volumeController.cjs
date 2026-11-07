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
  async getVolume() {
    try {
      const psCommand = `${CORE_AUDIO_SCRIPT}
$v = [math]::Round([AudioController]::GetVolume() * 100)
$m = [AudioController]::GetMute()
Write-Output "$v|$m"
`;
      const { stdout } = await runPowerShell(psCommand);
      const parts = stdout.trim().split('|');
      const vol = parseInt(parts[0], 10);
      const isMuted = parts[1] ? parts[1].toLowerCase() === 'true' : false;
      return {
        volume: isNaN(vol) ? 50 : vol,
        muted: isMuted,
        verified: !isNaN(vol)
      };
    } catch (err) {
      console.error('Failed to get volume:', err.message);
      return { volume: 50, muted: false, verified: false, error: err.message };
    }
  }

  async setVolume(percentage) {
    try {
      const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
      const scalar = (clamped / 100).toFixed(2);
      const psCommand = `${CORE_AUDIO_SCRIPT}
[AudioController]::SetVolume(${scalar})
[AudioController]::SetMute($false)
$v = [math]::Round([AudioController]::GetVolume() * 100)
Write-Output "$v"
`;
      const { stdout } = await runPowerShell(psCommand);
      const verifiedVol = parseInt(stdout.trim(), 10);
      const ok = !isNaN(verifiedVol) && Math.abs(verifiedVol - clamped) <= 2;
      return {
        success: ok,
        volume: verifiedVol,
        message: `System volume set to ${verifiedVol}%`,
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

  async setMute(mute) {
    try {
      const muteArg = mute ? '$true' : '$false';
      const psCommand = `${CORE_AUDIO_SCRIPT}
[AudioController]::SetMute(${muteArg})
$m = [AudioController]::GetMute()
Write-Output "$m"
`;
      const { stdout } = await runPowerShell(psCommand);
      const isMuted = stdout.trim().toLowerCase() === 'true';
      return {
        success: true,
        muted: isMuted,
        message: isMuted ? 'System audio muted' : 'System audio unmuted',
        verified: isMuted === mute
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
