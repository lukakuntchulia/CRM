import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. მონაცემების ინიციალიზაცია
let properties = JSON.parse(localStorage.getItem('realEstateCRM')) || [];
let pendingProperty = null;

// თქვენი მუდმივი (Default) გასაღები
const DEFAULT_API_KEY = "AIzaSyAkUPpT041PgtFzdSKOMOwxYppAPbZoEsM";

// 2. გვერდის ჩატვირთვისას გაშვება
document.addEventListener("DOMContentLoaded", () => {
    setupApiKey(); // გასაღების კონფიგურაცია
    renderTable(); // ცხრილის დახატვა
});

// 3. API Key-ს მართვის ლოგიკა
function setupApiKey() {
    const storedKey = localStorage.getItem('geminiApiKey');
    
    // თუ გასაღები საერთოდ არ არსებობს, ვადგენთ თქვენს მითითებულ გასაღებს
    if (!storedKey || storedKey.trim() === "") {
        localStorage.setItem('geminiApiKey', DEFAULT_API_KEY);
        console.log("სისტემამ გამოიყენა ნაგულისხმევი API გასაღები.");
    }
}

function getActiveApiKey() {
    return localStorage.getItem('geminiApiKey') || DEFAULT_API_KEY;
}

window.global_saveApiKey = function() {
    const keyInput = document.getElementById('apiKeyInput').value.trim();
    if (keyInput.length < 20) return alert("გთხოვთ შეიყვანოთ ვალიდური გასაღები!");
    
    localStorage.setItem('geminiApiKey', keyInput);
    document.getElementById('apiKeyModal').style.display = 'none';
    alert("პარამეტრები განახლდა!");
    location.reload(); // გვერდის გადატვირთვა ცვლილებების ასასახად
};

// 4. ცხრილის დახატვა (Rendering)
function renderTable(data = properties) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.forEach(prop => {
        const tr = document.createElement('tr');
        
        // სტატუსის ვიზუალური ფერები
        let bgColor = 'transparent';
        if (prop.status === 'აქტიური') bgColor = 'var(--status-active)';
        if (prop.status === 'ჩანიშნულია') bgColor = 'var(--status-meeting)';
        if (prop.status === 'გაქირავდა ჩვენით') bgColor = 'var(--status-success)';
        if (prop.status === 'გაქირავდა სხვით') bgColor = 'var(--status-failed)';
        
        tr.style.backgroundColor = bgColor;
        tr.innerHTML = `
            <td data-label="მესაკუთრე">${prop.owner_name || 'N/A'}</td>
            <td data-label="ტელეფონი">${prop.phone || 'N/A'}</td>
            <td data-label="ბმული">${prop.link ? `<a href="${prop.link}" target="_blank">ბმული</a>` : 'N/A'}</td>
            <td data-label="გარიგება">${prop.deal_type || 'N/A'}</td>
            <td data-label="ტიპი">${prop.prop_type || 'N/A'}</td>
            <td data-label="ლოკაცია">${prop.location || 'N/A'} - ${prop.price || ''}</td>
            <td data-label="სოც. ნებართვა">${prop.social_permit || 'N/A'}</td>
            <td data-label="პირობები">${prop.conditions || 'N/A'}</td>
            <td data-label="კომენტარი">${prop.comment || 'N/A'}</td>
            <td data-label="Agency ID">${prop.agency_id || 'N/A'}</td>
            <td data-label="კლიენტი" contenteditable="true" onblur="global_updateField(${prop.internal_id}, 'client_name', this.innerText)">${prop.client_name || ''}</td>
            <td data-label="კლიენტის ტელ" contenteditable="true" onblur="global_updateField(${prop.internal_id}, 'client_phone', this.innerText)">${prop.client_phone || ''}</td>
            <td data-label="სტატუსი">
                <select class="status-dropdown" onchange="global_updateStatus(${prop.internal_id}, this.value)">
                    <option value="აქტიური" ${prop.status === 'აქტიური' ? 'selected' : ''}>აქტიური</option>
                    <option value="ჩანიშნულია" ${prop.status === 'ჩანიშნულია' ? 'selected' : ''}>ჩანიშნულია</option>
                    <option value="გაქირავდა ჩვენით" ${prop.status === 'გაქირავდა ჩვენით' ? 'selected' : ''}>ჩვენით</option>
                    <option value="გაქირავდა სხვით" ${prop.status === 'გაქირავდა სხვით' ? 'selected' : ''}>სხვით</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 5. ძებნის ლოგიკა
window.global_filterTable = function() {
    const q = document.getElementById('searchInput').value.toLowerCase().replace(/\s+/g, '');
    const filtered = properties.filter(p => 
        (p.agency_id && String(p.agency_id).toLowerCase().includes(q)) || 
        (p.phone && String(p.phone).replace(/\D/g,'').includes(q)) ||
        (p.owner_name && p.owner_name.toLowerCase().includes(q))
    );
    renderTable(filtered);
};

// ==========================================
// 6. AI დამუშავება (Gemini API - Smart Fallback)
// ==========================================
window.global_openAIModal = function() { 
    document.getElementById('aiModal').style.display = 'flex'; 
};

window.global_closeModal = function(id) { 
    document.getElementById(id).style.display = 'none'; 
};

window.global_processAI = async function() {
    const rawText = document.getElementById('aiInput').value;
    if (!rawText.trim()) return alert("გთხოვთ შეიყვანოთ ტექსტი!");

    const apiKey = getActiveApiKey();
    const btn = document.querySelector('#aiModal .btn-save');
    
    btn.innerText = "კავშირი მყარდება...";
    btn.disabled = true;

    // მოდელების სია, რომლებსაც სათითაოდ ვცდით (თუ პირველი 404-ს ამოაგდებს)
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"];
    let success = false;

    for (let modelName of modelsToTry) {
        if (success) break;

        try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // კრიტიკული ცვლილება: ვაიძულებთ SDK-ს გამოიყენოს 'v1' (სტაბილური) ვერსია 'v1beta'-ს ნაცვლად
        const model = genAI.getGenerativeModel(
            { model: "gemini-1.5-flash" }, 
            { apiVersion: "v1" } 
        );

        const prompt = `ამოიღე მონაცემები ტექსტიდან და დააბრუნე მხოლოდ სუფთა JSON: 
        { "owner_name": "", "phone": "", "link": "", "deal_type": "", "prop_type": "", "location": "", "price": "", "social_permit": "", "conditions": "", "comment": "", "agency_id": "" }
        ტექსტი: "${rawText}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // ტექსტის გასუფთავება Markdown-ისგან
        let responseText = response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
            
            // გასუფთავება იმ შემთხვევაში, თუ AI მაინც ჩაწერს Markdown-ს
            let text = response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
            const data = JSON.parse(text);
            
            // თუ აქამდე მოაღწია, ნიშნავს რომ მოდელმა იმუშავა
            data.internal_id = Date.now();
            data.status = "აქტიური";
            data.client_name = ""; 
            data.client_phone = "";

            global_closeModal('aiModal');
            document.getElementById('aiInput').value = '';

            if (!data.phone || data.phone === "N/A" || data.phone === "") {
                pendingProperty = data;
                document.getElementById('phoneWarningModal').style.display = 'flex';
            } else {
                saveToDB(data);
            }
            
            success = true;
            console.log(`წარმატებით დამუშავდა მოდელით: ${modelName}`);

        } catch (e) {
            console.warn(`მოდელმა ${modelName} დააბრუნა შეცდომა:`, e.message);
            // თუ ბოლო მოდელიცაა და მაინც შეცდომაა
            if (modelName === modelsToTry[modelsToTry.length - 1]) {
                alert("შეცდომა: AI სერვისი დროებით მიუწვდომელია. შეამოწმეთ API გასაღები.");
            }
        }
    }

    btn.innerText = "დამუშავება";
    btn.disabled = false;
};

// 7. შენახვის ფუნქციები
function saveToDB(data) {
    properties.unshift(data);
    localStorage.setItem('realEstateCRM', JSON.stringify(properties));
    renderTable();
}

window.global_saveWithManualPhone = function() {
    const manualNum = document.getElementById('manualPhoneInput').value;
    if (!manualNum) return alert("მიუთითეთ ნომერი!");
    pendingProperty.phone = manualNum;
    saveToDB(pendingProperty);
    global_closeModal('phoneWarningModal');
    document.getElementById('manualPhoneInput').value = '';
};

window.global_saveWithoutPhone = function() {
    saveToDB(pendingProperty);
    global_closeModal('phoneWarningModal');
};

window.global_updateField = function(id, field, val) {
    const i = properties.findIndex(p => p.internal_id === id);
    if (i > -1) {
        properties[i][field] = val.trim();
        localStorage.setItem('realEstateCRM', JSON.stringify(properties));
    }
};

window.global_updateStatus = function(id, status) {
    const i = properties.findIndex(p => p.internal_id === id);
    if (i > -1) {
        properties[i].status = status;
        localStorage.setItem('realEstateCRM', JSON.stringify(properties));
        renderTable();
    }
};
