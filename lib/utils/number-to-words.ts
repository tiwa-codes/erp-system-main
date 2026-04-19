export function numberToWords(num: number): string {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Million', 'Billion'];

    if (num === 0) return 'Zero';

    function convertChunk(n: number): string {
        let chunk = '';
        if (n >= 100) {
            chunk += units[Math.floor(n / 100)] + ' Hundred ';
            n %= 100;
            if (n > 0) chunk += 'and ';
        }
        if (n >= 20) {
            chunk += tens[Math.floor(n / 10)] + (n % 10 > 0 ? '-' + units[n % 10] : '');
        } else if (n > 0) {
            chunk += units[n];
        }
        return chunk.trim();
    }

    let result = '';
    let scaleIndex = 0;
    let integerPart = Math.floor(num);
    let decimalPart = Math.round((num - integerPart) * 100);

    while (integerPart > 0) {
        const chunk = integerPart % 1000;
        if (chunk > 0) {
            const chunkWords = convertChunk(chunk);
            result = chunkWords + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '') + (result ? ', ' + result : '');
        }
        integerPart = Math.floor(integerPart / 1000);
        scaleIndex++;
    }

    result = result.trim();

    if (decimalPart > 0) {
        result += ' Naira and ' + convertChunk(decimalPart) + ' Kobo';
    } else {
        result += ' Naira Only';
    }

    return result;
}
