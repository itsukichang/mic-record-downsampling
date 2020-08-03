let scriptProcessor = null;
let audioContext = null;
let audioData = [];
let bufferSize = 1024;
let oldSampleRate = null;
let newSampleRate = 16000;

const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const downloadLink = document.getElementById('download');
stopButton.setAttribute('disabled', 'disabled');

const exportWAV = (audioData) => {
  const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const floatTo16BitPCM = (output, offset, input) => {
      for (let i = 0; i < input.length; i++ , offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    };

    writeString(view, 0, 'RIFF');  // RIFFヘッダ
    view.setUint32(4, 32 + samples.length * 2, true); // これ以降のファイルサイズ
    writeString(view, 8, 'WAVE'); // WAVEヘッダ
    writeString(view, 12, 'fmt '); // fmtチャンク
    view.setUint32(16, 16, true); // fmtチャンクのバイト数
    view.setUint16(20, 1, true); // フォーマットID
    view.setUint16(22, 1, true); // チャンネル数
    view.setUint32(24, sampleRate, true); // サンプリングレート
    view.setUint32(28, sampleRate * 2, true); // データ速度
    view.setUint16(32, 2, true); // ブロックサイズ
    view.setUint16(34, 16, true); // サンプルあたりのビット数
    writeString(view, 36, 'data'); // dataチャンク
    view.setUint32(40, samples.length * 2, true); // 波形データのバイト数
    floatTo16BitPCM(view, 44, samples); // 波形データ

    return view;
  };

  const mergeBuffers = (audioData) => {
    let sampleLength = 0;
    for (let i = 0; i < audioData.length; i++) {
      sampleLength += audioData[i].length;
    }
    const samples = new Float32Array(sampleLength);
    let sampleIdx = 0;
    for (let i = 0; i < audioData.length; i++) {
      for (let j = 0; j < audioData[i].length; j++) {
        samples[sampleIdx] = audioData[i][j];
        sampleIdx++;
      }
    }
    return samples;
  };

  const dataview = encodeWAV(mergeBuffers(audioData), newSampleRate);
  const audioBlob = new Blob([dataview], { type: 'audio/wav' });
  const audio = document.getElementById('audio');
  //オーディオ要素にもBlobをリンクする
  audio.src = URL.createObjectURL(audioBlob);
  const myURL = window.URL || window.webkitURL;
  const url = myURL.createObjectURL(audioBlob);
  return url;
};

const saveAudio = () => {
  downloadLink.href = exportWAV(audioData);
  downloadLink.download = 'test.wav';
  audioContext.close();
};

const onAudioProcess = (e) => {
  const input = e.inputBuffer.getChannelData(0);
  const ResampleData = interpolateArray(input, input.length * (newSampleRate / oldSampleRate));

  //バッファーサイズを1024から変更後のサンプルレートに合わせたサイズへ変更
  bufferSize = input.length * (newSampleRate/oldSampleRate);


  const bufferData = new Float32Array(bufferSize);
  for (let i = 0; i < bufferSize; i++) {
    bufferData[i] = ResampleData[i];
  }
  audioData.push(bufferData);
};

//サンプリングレート変換の実態
const interpolateArray = (data, fitCount)  => {
  const linearInterpolate = (before, after, atPoint) => {
    return before + (after - before) * atPoint;
  };

  const newData = new Array();
  const springFactor = new Number((data.length - 1) / (fitCount - 1));
  newData[0] = data[0]; // for new allocation
  for (let i = 1; i < fitCount - 1; i++) {
    let tmp = i * springFactor;
    let before = new Number(Math.floor(tmp)).toFixed();
    let after = new Number(Math.ceil(tmp)).toFixed();
    let atPoint = tmp - before;
    newData[i] = linearInterpolate(data[before], data[after], atPoint);
  }
  newData[fitCount - 1] = data[data.length - 1]; // for new allocation
  return newData;
};

const initState = () => {
  scriptProcessor = null;
  audioContext = null;
  audioData = [];
  bufferSize = 1024;
  oldSampleRate = null;
  newSampleRate = 16000;
}


const handleStartRecord = (stream) => {
  startButton.setAttribute('disabled', 'disabled');
  stopButton.removeAttribute('disabled');
  initState();
  audioContext = new AudioContext();
  oldSampleRate = audioContext.sampleRate;
  scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
  const mediastreamsource = audioContext.createMediaStreamSource(stream);
  mediastreamsource.connect(scriptProcessor);
  scriptProcessor.onaudioprocess = onAudioProcess;
  scriptProcessor.connect(audioContext.destination);
};

const handleStopRecord = () => {
  startButton.removeAttribute('disabled');
  stopButton.setAttribute('disabled', 'disabled');
  saveAudio();
};
//マイクデバイスの利用許可の確認を行う
navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
  startButton.addEventListener('click', () => {
    handleStartRecord(stream);
  });

  stopButton.addEventListener('click', () => {
    handleStopRecord();
  });

});
