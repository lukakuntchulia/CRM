// ==========================================
// 1. მონაცემების ინიციალიზაცია
// ==========================================
let properties = JSON.parse(localStorage.getItem('realEstateCRM_V3')) || [];
let pendingProperty = null;

// თქვენი Google API გასაღები
const DEFAULT_KEY = "AIzaSyAkUPpT041PgtFzdSKOMOwxYppAPbZoEsM";

document.addEventListener("DOMContentLoaded", () => {
    if (!localStorage.getItem('crm_api_key')) {
        localStorage.setItem('crm_api_key', DEFAULT_KEY);
    }
    window.global_renderTable();
});

function getCleanKey() {
    const key = localStorage.getItem('crm_api_key') || DEFAULT_KEY;
    return key.replace(/[^\x21-\x7E]/g, "").trim();
}

// ==========================================
// 2. მოდალის და ფანჯრების მართვა
// ==========================================
window.global_openModal = () => {
    document.getElementById('aiModal').style.display = 'flex';
    document.getElementById('aiInput').focus();
};

window.global_closeModal = (id) => {
    document.getElementById(id).style.display = 'none';
};

// ==========================================
// 3. AI დამუშავება (Advanced Error Handling)
// ==========================================
window.global_processAI = async function() {
    const rawText = document.getElementById('aiInput').value.trim();
    if (!rawText) return alert("გთხოვთ შეიყვანოთ ტექსტი!");

    const apiKey = getCleanKey();
    const btn = document.getElementById('processBtn');
    
    btn.innerText = "კავშირი...";
    btn.disabled = true;

    // ვცდით v1beta-ს, რადგან ის ყველაზე მოქნილია
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Extract real estate info from this Georgian text into JSON:
                        { "owner_name": "", "phone": "", "link": "", "deal_type": "", "prop_type": "", "location": "", "price": "", "social_permit": "", "conditions": "", "comment": "", "agency_id": "" }
                        Text: "${rawText}"`
                    }]
                }]
            })
        });

        const result = await response.json();

        // თუ Google-მა ისევ 404 ან სხვა შეცდომა დააბრუნა
        if (!response.ok) {
            console.error("Google API Error:", result);
            throw new Error(result.error?.message || "მოდელი მიუწვდომელია");
        }

        const aiText = result.candidates[0].content.parts[0].text;
        const cleanJson = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanJson);

        data.internal_id = Date.now();
        data.status = "აქტიური";
        
        window.global_saveProperty(data);
        window.global_closeModal('aiModal');
        document.getElementById('aiInput').value = "";

    } catch (e) {
        console.warn("AI Fallback triggered:", e.message);
        // თუ AI ვერ მუშაობს, გადავდივართ ხელით დამატებაზე, რომ წრეზე აღარ ვიაროთ
        alert("AI შეცდომა (404/Key). გადავდივართ მექანიკურ რეჟიმში.");
        window.global_openManualForm(rawText);
    } finally {
        btn.innerText = "დამუშავება";
        btn.disabled = false;
    }
};

// ==========================================
// 4. მექანიკური რეჟიმი (რომ არ გაიჭედოთ)
// ==========================================
window.global_openManualForm = (text) => {
    // აქ შეგიძლიათ დაამატოთ მარტივი ფორმა, ან უბრალოდ ცარიელი ხაზი ჩასვათ
    const manualData = {
        internal_id: Date.now(),
        owner_name: "ხელით შესაყვანი",
        phone: "",
        link: "",
        deal_type: "ქირავდება",
        prop_type: "ბინა",
        location: text.substring(0, 20) + "...",
        price: "",
        social_permit: "კი",
        conditions: "",
        comment: "AI ვერ ჩაიტვირთა",
        agency_id: "",
        status: "აქტიური"
    };
    window.global_saveProperty(manualData);
    window.global_closeModal('aiModal');
};

// ==========================================
// 5. შენახვა და ცხრილის მართვა
// ==========================================
window.global_saveProperty = (data) => {
    properties.unshift(data);
    localStorage.setItem('realEstateCRM_V3', JSON.stringify(properties));
    window.global_renderTable();
};

window.global_renderTable = function(data = properties) {
    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    data.forEach(prop => {
        const tr = document.createElement('tr');
        tr.className = window.global_getStatusClass(prop.status);
        
        tr.innerHTML = `
            <td data-label="მესაკუთრე" contenteditable="true" onblur="window.global_updateField(${prop.internal_id}, 'owner_name', this.innerText)">${prop.owner_name || ''}</td>
            <td data-label="ტელეფონი" contenteditable="true" onblur="window.global_updateField(${prop.internal_id}, 'phone', this.innerText)">${prop.phone || ''}</td>
            <td data-label="Link">${prop.link ? `<a href="${prop.link}" target="_blank">🔗</a>` : ''}</td>
            <td data-label="გარიგება">${prop.deal_type || ''}</td>
            <td data-label="ტიპი">${prop.prop_type || ''}</td>
            <td data-label="ლოკაცია & ფასი">${prop.location || ''} - ${prop.price || ''}</td>
            <td data-label="სოც. ნებართვა">${prop.social_permit || ''}</td>
            <td data-label="პირობები">${prop.conditions || ''}</td>
            <td data-label="კომენტარი">${prop.comment || ''}</td>
            <td data-label="Agency ID">${prop.agency_id || ''}</td>
            <td data-label="კლიენტი" contenteditable="true" onblur="window.global_updateField(${prop.internal_id}, 'client_name', this.innerText)">${prop.client_name || ''}</td>
            <td data-label="კლიენტის ტელ" contenteditable="true" onblur="window.global_updateField(${prop.internal_id}, 'client_phone', this.innerText)">${prop.client_phone || ''}</td>
            <td data-label="შედეგი">
                <select onchange="window.global_updateStatus(${prop.internal_id}, this.value)">
                    <option value="აქტიური" ${prop.status === 'აქტიური' ? 'selected' : ''}>აქტიური</option>
                    <option value="ჩანიშნულია" ${prop.status === 'ჩანიშნულია' ? 'selected' : ''}>ჩანიშნულია</option>
                    <option value="ჩვენით" ${prop.status === 'ჩვენით' ? 'selected' : ''}>ჩვენით</option>
                    <option value="სხვით" ${prop.status === 'სხვით' ? 'selected' : ''}>სხვით</option>
                </select>
            </td>
            <td><button onclick="window.global_deleteRow(${prop.internal_id})" style="background:none; border:none; color:red; cursor:pointer;">🗑</button></td>
        `;
        tbody.appendChild(tr);
    });
};

window.global_getStatusClass = (s) => {
    if (s === 'ჩანიშნულია') return 'status-meeting';
    if (s === 'ჩვენით') return 'status-success';
    if (s === 'სხვით') return 'status-failed';
    return 'status-default';
};

window.global_updateField = (id, field, val) => {
    const idx = properties.findIndex(p => p.internal_id === id);
    if (idx !== -1) {
        properties[idx][field] = val.trim();
        localStorage.setItem('realEstateCRM_V3', JSON.stringify(properties));
    }
};

window.global_updateStatus = (id, status) => {
    const idx = properties.findIndex(p => p.internal_id === id);
    if (idx !== -1) {
        properties[idx].status = status;
        localStorage.setItem('realEstateCRM_V3', JSON.stringify(properties));
        window.global_renderTable();
    }
};

window.global_deleteRow = (id) => {
    if (confirm("წავშალოთ?")) {
        properties = properties.filter(p => p.internal_id !== id);
        localStorage.setItem('realEstateCRM_V3', JSON.stringify(properties));
        window.global_renderTable();
    }
};

window.global_filterTable = () => {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    const filtered = properties.filter(p => 
        (p.agency_id && String(p.agency_id).includes(q)) ||
        (p.phone && p.phone.includes(q)) ||
        (p.owner_name && p.owner_name.toLowerCase().includes(q))
    );
    window.global_renderTable(filtered);
};
