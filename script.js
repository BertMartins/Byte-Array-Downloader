document.addEventListener('DOMContentLoaded', function () {
    const inputTypeSelect = document.getElementById('input-type');
    const textInputContainer = document.getElementById('text-input-container');
    const fileInputContainer = document.getElementById('file-input-container');
    const byteInput = document.getElementById('byte-input');
    const fileInput = document.getElementById('file-input');
    const processBtn = document.getElementById('process-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resultContainer = document.getElementById('result-container');
    const fileTypeSpan = document.getElementById('file-type');
    const fileSizeSpan = document.getElementById('file-size');
    const loadingContainer = document.getElementById('loading-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const filenameInput = document.getElementById('filename');

    let fileBlob = null;
    let detectedExtension = '';

    // Trocar entre entrada de texto e arquivo
    inputTypeSelect.addEventListener('change', function () {
        if (this.value === 'file') {
            textInputContainer.classList.add('hidden');
            fileInputContainer.classList.remove('hidden');
        } else {
            textInputContainer.classList.remove('hidden');
            fileInputContainer.classList.add('hidden');
        }
        hideResults();
    });

    // Processar dados
    processBtn.addEventListener('click', async function () {
        hideResults();
        showLoading();

        try {
            const inputType = inputTypeSelect.value;
            let bytes;

            if (inputType === 'file') {
                if (!fileInput.files.length) {
                    throw new Error('Selecione um arquivo para processar.');
                }
                const file = fileInput.files[0];
                bytes = new Uint8Array(await file.arrayBuffer());
            } else {
                // Processar entrada de texto
                const inputText = byteInput.value.trim();
                if (!inputText) {
                    throw new Error('Insira os dados para processar.');
                }

                bytes = parseInputToBytes(inputText, inputType);
            }

            if (!bytes || !bytes.length) {
                throw new Error('Não foi possível interpretar os dados de entrada.');
            }

            // Detectar o tipo de arquivo
            detectedExtension = detectFileExtension(bytes);

            // Criar Blob para download
            fileBlob = new Blob([bytes], { type: getContentType(detectedExtension) });

            // Mostrar resultados
            fileTypeSpan.textContent = detectedExtension;
            fileSizeSpan.textContent = formatBytes(fileBlob.size);
            resultContainer.classList.remove('hidden');
        } catch (error) {
            showError(error.message);
        } finally {
            hideLoading();
        }
    });

    // Download do arquivo
    downloadBtn.addEventListener('click', function () {
        if (!fileBlob) {
            showError('Nenhum arquivo para download. Processe os dados primeiro.');
            return;
        }

        const filename = filenameInput.value || 'arquivo';
        const fullFilename = filename + detectedExtension;

        const downloadUrl = URL.createObjectURL(fileBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = fullFilename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
    });

    // Função para analisar diferentes formatos de entrada
    function parseInputToBytes(input, inputType) {
        switch (inputType) {
            case 'byte-array':
                // Tenta analisar como array de bytes decimal
                try {
                    // Remover caracteres não numéricos exceto vírgulas e espaços
                    let cleanInput = input.replace(/[^\d,\s\[\]]/g, '');
                    // Remover colchetes
                    cleanInput = cleanInput.replace(/[\[\]]/g, '');
                    // Dividir por vírgulas e converter para números
                    const bytesArray = cleanInput.split(',')
                        .map(s => s.trim())
                        .filter(s => s !== '')
                        .map(s => parseInt(s, 10));

                    if (bytesArray.some(isNaN)) {
                        throw new Error('Array de bytes contém valores inválidos.');
                    }

                    return new Uint8Array(bytesArray);
                } catch (e) {
                    throw new Error('Formato de array de bytes inválido: ' + e.message);
                }

            case 'hex-array':
                try {
                    // Remove espaços e colchetes
                    let cleanInput = input.replace(/[\s\[\]]/g, '');

                    // Se conter vírgula, trata como lista separada
                    if (cleanInput.includes(',')) {
                        cleanInput = cleanInput.replace(/[^0-9a-fA-F,xX,]/g, '');
                        const bytesArray = cleanInput.split(',')
                            .map(s => s.trim())
                            .filter(s => s !== '')
                            .map(s => {
                                if (s.toLowerCase().startsWith('0x')) {
                                    return parseInt(s, 16);
                                }
                                return parseInt(s, 16);
                            });

                        if (bytesArray.some(isNaN)) {
                            throw new Error('Array hexadecimal contém valores inválidos.');
                        }
                        return new Uint8Array(bytesArray);
                    } else {
                        // Trata como hex contínuo: 0x... ou apenas ...
                        if (cleanInput.startsWith('0x') || cleanInput.startsWith('0X')) {
                            cleanInput = cleanInput.slice(2);
                        }
                        if (!/^[0-9a-fA-F]+$/.test(cleanInput)) {
                            throw new Error('String hexadecimal inválida.');
                        }
                        if (cleanInput.length % 2 !== 0) {
                            throw new Error('Número de caracteres ímpar em hexadecimal.');
                        }
                        const bytesArray = [];
                        for (let i = 0; i < cleanInput.length; i += 2) {
                            bytesArray.push(parseInt(cleanInput.substr(i, 2), 16));
                        }
                        return new Uint8Array(bytesArray);
                    }
                } catch (e) {
                    throw new Error('Formato de array hexadecimal inválido: ' + e.message);
                }

            case 'base64':
                // Tenta analisar como base64
                try {
                    const binaryString = atob(input);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    return bytes;
                } catch (e) {
                    throw new Error('Formato Base64 inválido: ' + e.message);
                }

            default:
                throw new Error('Tipo de entrada não suportado.');
        }
    }

    // Função para detectar a extensão do arquivo com base nos bytes
    function detectFileExtension(bytes) {
        debugger
        // PDF - %PDF
        if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
            return '.pdf';
        }

        // RAR - Rar!
        if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) {
            return '.rar';
        }

        // XLS antigo (Excel 97-2003) - D0 CF 11 E0
        if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
            return '.xls';
        }

        if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
            const sampleSize = Math.min(bytes.length, 2048);
            let sampleText = '';
            for (let i = 0; i < sampleSize; i++) {
                sampleText += String.fromCharCode(bytes[i]);
            }

            if (sampleText.includes('xl/')) {
                return '.xlsx';
            } else if (sampleText.includes('word/')) {
                return '.docx';
            } else if (sampleText.includes('ppt/')) {
                return '.pptx';
            }

            return '.zip'; // se nada identificado
        }


        // JPEG - FF D8 FF
        if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            return '.jpg';
        }

        // PNG - 89 50 4E 47
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            return '.png';
        }

        // GIF - GIF87a ou GIF89a
        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
            (bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61)) {
            return '.gif';
        }

        // MP3 - ID3 ou FFFB
        if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
            (bytes[0] === 0xFF && bytes[1] === 0xFB)) {
            return '.mp3';
        }

        // MP4 - ftyp
        if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
            return '.mp4';
        }

        // WebM - 1A 45 DF A3
        if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
            return '.webm';
        }

        // Microsoft Office - D0 CF 11 E0
        if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
            return '.doc'; // Poderia ser .ppt ou .doc, mas usamos .doc como padrão
        }

        // Detectar CSV (baseado no conteúdo)
        // Convertemos um pedaço dos bytes para texto e analisamos
        if (bytes.length > 20) {
            // Obter uma amostra dos primeiros bytes para análise
            const sampleSize = Math.min(100, bytes.length);
            let sampleText = '';
            for (let i = 0; i < sampleSize; i++) {
                sampleText += String.fromCharCode(bytes[i]);
            }

            // Verificar padrões comuns em arquivos CSV
            const hasSemicolons = sampleText.includes(';');
            const hasCommas = sampleText.includes(',');
            const hasNewlines = sampleText.includes('\n') || sampleText.includes('\r\n');
            const hasTabulations = sampleText.includes('\t');

            // Verificar se tem estrutura de linhas com separadores consistentes
            if (hasNewlines && (hasSemicolons || hasCommas || hasTabulations)) {
                const lines = sampleText.split(/\r?\n/);
                if (lines.length > 1) {
                    // Verificar se as linhas têm uma estrutura similar (mesmo número de separadores)
                    const separators = hasSemicolons ? ';' : (hasCommas ? ',' : '\t');
                    const firstLineSepCount = (lines[0].match(new RegExp(separators, 'g')) || []).length;

                    // Se a primeira linha tem separadores e pelo menos mais uma linha tem número similar de separadores
                    if (firstLineSepCount > 0) {
                        let similarLines = 0;
                        for (let i = 1; i < Math.min(5, lines.length); i++) {
                            if (lines[i].trim()) {
                                const lineSepCount = (lines[i].match(new RegExp(separators, 'g')) || []).length;
                                if (Math.abs(lineSepCount - firstLineSepCount) <= 1) {
                                    similarLines++;
                                }
                            }
                        }

                        if (similarLines > 0) {
                            return '.csv';
                        }
                    }
                }
            }
        }

        return '.txt';
    }

    // Função para verificar se os bytes provavelmente representam texto
    function isLikelyText(bytes) {
        // Se for muito pequeno, não é confiável determinar
        if (bytes.length < 10) {
            return false;
        }

        // Conta bytes que estão em intervalos comuns para texto
        let textBytes = 0;
        let totalBytes = Math.min(bytes.length, 1000); // Limita a análise aos primeiros 1000 bytes

        for (let i = 0; i < totalBytes; i++) {
            const b = bytes[i];
            // Caracteres ASCII comuns: letras, números, pontuação, espaços, quebras de linha
            if ((b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13) {
                textBytes++;
            }
        }

        // Se pelo menos 80% dos bytes parecem texto, provavelmente é um arquivo de texto
        return (textBytes / totalBytes) > 0.8;
    }

    // Função para obter o tipo MIME com base na extensão
    function getContentType(extension) {
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.rar': 'application/x-rar-compressed',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.zip': 'application/zip',
            '.txt': 'text/plain',
            '.bin': 'application/octet-stream',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.doc': 'application/msword',
            '.csv': 'text/csv'
        };

        return mimeTypes[extension] || 'application/octet-stream';
    }

    // Função para formatar tamanho em bytes
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Funções helpers para UI
    function hideResults() {
        resultContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
    }

    function showLoading() {
        loadingContainer.classList.remove('hidden');
    }

    function hideLoading() {
        loadingContainer.classList.add('hidden');
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorContainer.classList.remove('hidden');
    }
});