import { GoogleGenerativeAI } from "@google/generative-ai";

// ==========================================
// 1. გლობალური შეცდომების დამჭერი (დებაგინგისთვის)
// ==========================================
window.onerror = function(msg, url, line) {
    alert("სისტემური შეცდომა: " + msg + "\nხაზი: " + line);
};

// ==========================================
// 2. ტელეგრამის ინიციალიზაცია
// ==========================================
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    
    // აქ შეგიძლიათ ჩაწეროთ თქვენი ID-ები მომავალში წვდომის შეზღუდვისთვის
    const currentUser = window.Telegram.WebApp.initDataUnsafe?.user?.id;
}

// ==========================================
// 3. მონაცემების მართვა (LocalStorage)
// ==========================================
let properties = JSON.parse(localStorage.getItem('realEstateCRM')) || [];
let pendingProperty = null;

document.addEventListener("DOMContentLoaded", () => {
    renderTable();

    // 🚀 ვამოწმებთ გასაღებს გვერდის ჩატვირთვისთანავე
    const apiKey = getStoredApiKey();
    if (!apiKey) {
        // თუ გასაღები არ არის, ვაჩვენებთ ფანჯარას
        const modal = document.getElementById('apiKeyModal');
        if (modal) modal.style.display = 'flex';
    }
});

// API გასაღების ამოღება მეხსიერებიდან
function getStoredApiKey() {
    return localStorage.getItem('geminiApiKey');
}

// API გასაღების შენახვა (მოდალიდან)
window.global_saveApiKey = function() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key.length < 20) return alert("გთხოვთ შეიყვანოთ ვალიდური API გასაღები!");
    localStorage.setItem('geminiApiKey', key);
    document.getElementById('apiKeyModal').style.display = 'none';
    alert("კონფიგურაცია წარმატებულია!");
    location.reload(); // გვერდის გადატვირთვა ქეშის გასაწმენდად
};

// ==========================================
// 4. ინტერფეისის ხატვა (Table Rendering)
// ==========================================
function renderTable(data = properties) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.forEach(prop => {
        const tr = document.createElement('tr');
        
        // სტატუსის მიხედვით ფერების მინიჭება
        let rowBgColor = 'transparent';
        if (prop.status === 'აქტიური') rowBgColor = 'rgba(76, 175, 80, 0.1)';
        if (prop.status === 'ჩანიშნულია') rowBgColor = 'rgba(255, 193, 7, 0.1)';
        if (prop.status === 'გაქირავდა ჩვენით') rowBgColor = 'rgba(33, 150, 243, 0.1)';
        if (prop.status === 'გაქირავდა სხვით') rowBgColor = 'rgba(244, 67, 54, 0.1)';
        
        tr.style.backgroundColor = rowBgColor;
        tr.innerHTML = `
            <td data-label="მესაკუთრე">${prop.owner_name || 'N/A'}</td>
            <td data-label="მესაკუთრის ტელ">${prop.phone || 'N/A'}</td>
            <td data-label="Link">${prop.link ? `<a href="${prop.link}" target="_blank">ბმული</a>` : 'N/A'}</td>
            <td data-label="გარიგება">${prop.deal_type || 'N/A'}</td>
            <td data-label="ტიპი">${prop.prop_type || 'N/A'}</td>
            <td data-label="ლოკაცია & ფასი">${prop.location || 'N/A'} - ${prop.price || ''}</td>
            <td data-label="სოც. ქსელი">${prop.social_permit || 'N/A'}</td>
            <td data-label="პირობები">${prop.conditions || 'N/A'}</td>
            <td data-label="კომენტარი">${prop.comment || 'N/A'}</td>
            <td data-label="Agency ID">${prop.agency_id || 'N/A'}</td>
            <td data-label="კლიენტის სახ" contenteditable="true" onblur="global_updateInlineField(${prop.internal_id}, 'client_name', this.innerText)">${prop.client_name || ''}</td>
            <td data-label="კლიენტის ტელ" contenteditable="true" onblur="global_updateInlineField(${prop.internal_id}, 'client_phone', this.innerText)">${prop.client_phone || ''}</td>
            <td data-label="შედეგი">
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

// ==========================================
// 5. ძებნა და ფილტრაცია
// ==========================================
window.global_filterTable = function() {
    const rawQuery = document.getElementById('searchInput').value.toLowerCase();
    const query = rawQuery.replace(/\s+/g, ''); 
    const filtered = properties.filter(prop => {
        const matchID = prop.agency_id ? String(prop.agency_id).toLowerCase().includes(query) : false;
        const matchPhone = prop.phone ? String(prop.phone).replace(/[-\s]/g, '').includes(query) : false;
        const matchPrice = prop.price ? String(prop.price).replace(/\s+/g, '').toLowerCase().includes(query) : false;
        return matchID || matchPhone || matchPrice;
    });
    renderTable(filtered);
};

// ==========================================
// 6. AI ლოგიკა (Gemini API)
// ==========================================
window.global_openAIModal = function() { 
    document.getElementById('aiModal').style.display = 'flex'; 
};

window.global_closeModal = function(id) { 
    document.getElementById(id).style.display = 'none'; 
};

window.global_processAI = async function() {
    const rawText = document.getElementById('aiInput').value;
    if (!rawText) return alert("გთხოვთ შეიყვანოთ ტექსტი");

    const apiKey = getStoredApiKey();
    if (!apiKey) {
        document.getElementById('aiModal').style.display = 'none';
        document.getElementById('apiKeyModal').style.display = 'flex';
        return;
    }

    const saveBtn = document.querySelector('.btn-save');
    saveBtn.innerText = "მუშავდება...";
    saveBtn.disabled = true;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // ვიყენებთ სტაბილურ მოდელს ინსტრუქციების გარეშე (404-ის პრევენცია)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `შენ ხარ უძრავი ქონების ასისტენტი. ამოიღე მონაცემები ტექსტიდან და დააბრუნე მკაცრი JSON ობიექტი.
        ფორმატი: { 
            "owner_name": "", "phone": "", "link": "", "deal_type": "", "prop_type": "", 
            "location": "", "price": "", "social_permit": "", "conditions": "", 
            "comment": "", "agency_id": "" 
        }
        წესები: არ გამოიყენო Markdown (\`\`\`json). მხოლოდ JSON ტექსტი.
        ტექსტი დასამუშავებლად: "${rawText}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
        
        let extractedData = JSON.parse(responseText);

        // დამატებითი ველების ინიციალიზაცია
        extractedData.internal_id = Date.now();
        extractedData.status = "აქტიური";
        extractedData.client_name = ""; 
        extractedData.client_phone = "";

        global_closeModal('aiModal');
        document.getElementById('aiInput').value = '';

        // ნომრის შემოწმება
        if (!extractedData.phone || extractedData.phone === "N/A" || extractedData.phone === "") {
            pendingProperty = extractedData;
            document.getElementById('phoneWarningModal').style.display = 'flex';
        } else {
            saveToDB(extractedData);
        }

    } catch (error) {
        console.error("AI Error:", error);
        alert("შეცდომა დამუშავებისას: " + error.message);
    } finally {
        saveBtn.innerText = "დამუშავება";
        saveBtn.disabled = false;
    }
};

// ==========================================
// 7. მონაცემთა ბაზის ფუნქციები
// ==========================================
function saveToDB(data) {
    properties.unshift(data);
    localStorage.setItem('realEstateCRM', JSON.stringify(properties));
    renderTable();
}

window.global_saveWithManualPhone = function() {
    const num = document.getElementById('manualPhoneInput').value;
    if(!num) return alert("ჩაწერეთ ნომერი!");
    pendingProperty.phone = num;
    saveToDB(pendingProperty);
    global_closeModal('phoneWarningModal');
};

window.global_saveWithoutPhone = function() {
    saveToDB(pendingProperty);
    global_closeModal('phoneWarningModal');
};

window.global_updateInlineField = function(id, field, newValue) {
    const index = properties.findIndex(p => p.internal_id === id);
    if (index > -1) {
        properties[index][field] = newValue.trim();
        localStorage.setItem('realEstateCRM', JSON.stringify(properties));
    }
};

window.global_updateStatus = function(id, newStatus) {
    const index = properties.findIndex(p => p.internal_id === id);
    if (index > -1) {
        properties[index].status = newStatus;
        localStorage.setItem('realEstateCRM', JSON.stringify(properties));
        renderTable();
    }
};
