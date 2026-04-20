import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. ტელეგრამის ინიციალიზაცია
if(window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    
    // დროებით დავაკომენტაროთ ეს ნაწილი, რომ წვდომის პრობლემა გამოირიცხოს
    /*
    const currentUser = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    const allowedUsers = [123456789, 987654321]; 
    if (currentUser && !allowedUsers.includes(currentUser)) {
        alert("თქვენი ID არ არის დაშვებული: " + currentUser);
        throw new Error("Access Denied");
    }
    */
}

// დავამატოთ გლობალური შეცდომების დამჭერი, რომ ტელეფონზე ვნახოთ რა ფუჭდება
window.onerror = function(msg, url, line) {
    alert("Error: " + msg + "\nLine: " + line);
};
// ლოკალური ბაზის წამოღება
let properties = JSON.parse(localStorage.getItem('realEstateCRM')) || [];
let pendingProperty = null;

window.onload = () => renderTable();

// ცხრილის დახატვის ფუნქცია
function renderTable(data = properties) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    data.forEach(prop => {
        const tr = document.createElement('tr');
        
        // ფერის შერჩევა სტატუსის მიხედვით
        let rowBgColor = 'transparent';
        if(prop.status === 'აქტიური') rowBgColor = 'var(--status-active)';
        if(prop.status === 'ჩანიშნულია') rowBgColor = 'var(--status-meeting)';
        if(prop.status === 'გაქირავდა ჩვენით') rowBgColor = 'var(--status-success)';
        if(prop.status === 'გაქირავდა სხვით') rowBgColor = 'var(--status-failed)';
        
        tr.style.backgroundColor = rowBgColor;

        tr.innerHTML = `
            <td data-label="მესაკუთრე">${prop.owner_name || 'N/A'}</td>
            <td data-label="მესაკუთრის ტელ">${prop.phone || 'N/A'}</td>
            <td data-label="Link">${prop.link ? `<a href="${prop.link}" target="_blank" style="color:var(--primary-accent)">ბმული</a>` : 'N/A'}</td>
            <td data-label="გარიგება">${prop.deal_type || 'N/A'}</td>
            <td data-label="ტიპი">${prop.prop_type || 'N/A'}</td>
            <td data-label="ლოკაცია & ფასი">${prop.location || 'N/A'} - ${prop.price || ''}</td>
            <td data-label="სოც. ქსელი">${prop.social_permit || 'N/A'}</td>
            <td data-label="პირობები">${prop.conditions || 'N/A'}</td>
            <td data-label="კომენტარი">${prop.comment || 'N/A'}</td>
            <td data-label="Agency ID">${prop.agency_id || 'N/A'}</td>
            <td data-label="კლიენტის სახ" contenteditable="true" onblur="updateInlineField(${prop.internal_id}, 'client_name', this.innerText)">${prop.client_name || ''}</td>
            <td data-label="კლიენტის ტელ" contenteditable="true" onblur="updateInlineField(${prop.internal_id}, 'client_phone', this.innerText)">${prop.client_phone || ''}</td>
            <td data-label="შედეგი">
                <select class="status-dropdown" onchange="updateStatus(${prop.internal_id}, this.value)">
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

// მოდალების მართვა
function openAIModal() { document.getElementById('aiModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// AI დამუშავების სიმულაცია
// განახლებული ფუნქცია Gemini 1.5 Flash მოდელისთვის
async function processAI() {
    const rawText = document.getElementById('aiInput').value;
    if (!rawText) return alert("გთხოვთ შეიყვანოთ ტექსტი");

    const saveBtn = document.querySelector('.btn-save');
    saveBtn.innerText = "მუშავდება (Gemini)...";
    saveBtn.disabled = true;

    // ⚠️ დარწმუნდით, რომ აქ თქვენი ნამდვილი API გასაღები წერია
    const API_KEY = "YOUR_GEMINI_API_KEY"; 
    
    // განახლებული Endpoint Gemini 1.5 Flash-ისთვის
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const systemPrompt = `
    შენ ხარ უძრავი ქონების გამოცდილი ასისტენტი. შენი მიზანია ტექსტიდან ამოიღო კონკრეტული მონაცემები და დააბრუნო მხოლოდამხოლოდ სუფთა JSON ობიექტი. არ გამოიყენო Markdown (\`\`\`json). უბრალოდ დააბრუნე ობიექტი.
    
    ფორმატი: { 
      "owner_name": "სახელი", 
      "phone": "ტელეფონი", 
      "deal_type": "იყიდება/ქირავდება/გირავდება", 
      "prop_type": "ბინა/სახლი...", 
      "location": "ლოკაცია", 
      "price": "ფასი + ვალუტა", 
      "social_permit": "კი/არა", 
      "conditions": "მოკლე პირობა", 
      "comment": "დამატებითი კომენტარი", 
      "agency_id": "ID" 
    }
    
    ტექსტი დასამუშავებლად: "${rawText}"
    `;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // Gemini 1.5-ის განახლებული სტრუქტურა
                contents: [{
                    role: "user",
                    parts: [{ text: systemPrompt }]
                }]
            })
        });

        // თუ სტატუსი 200 (OK) არ არის, ვისვრით შეცდომას დეტალური ტექსტით
        if (!response.ok) {
            const errorDetails = await response.text();
            throw new Error(`API Error ${response.status}: ${errorDetails}`);
        }

        const data = await response.json();
        
        // ვამოწმებთ, დააბრუნა თუ არა API-მ რეალურად პასუხი
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
             throw new Error("API-მ დააბრუნა ცარიელი ან არასწორი სტრუქტურის პასუხი.");
        }

        let responseText = data.candidates[0].content.parts[0].text;
        
        // ვასუფთავებთ ზედმეტი სიმბოლოებისგან
        responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        let extractedData = JSON.parse(responseText);

        extractedData.internal_id = Date.now();
        extractedData.client_name = ""; 
        extractedData.client_phone = "";
        extractedData.status = "აქტიური"; 

        closeModal('aiModal');
        document.getElementById('aiInput').value = '';

        if (!extractedData.phone || extractedData.phone === "" || extractedData.phone === "N/A") {
            pendingProperty = extractedData;
            document.getElementById('phoneWarningModal').style.display = 'flex';
        } else {
            saveToDB(extractedData);
        }

    } catch (error) {
        console.error("Gemini Error Details:", error);
        alert("შეცდომა! დეტალები იხილეთ ბრაუზერის კონსოლში.");
    } finally {
        saveBtn.innerText = "დამუშავება";
        saveBtn.disabled = false;
    }
}

function saveWithManualPhone() {
    const num = document.getElementById('manualPhoneInput').value;
    if(!num) return alert("ჩაწერეთ ნომერი!");
    pendingProperty.phone = num;
    saveToDB(pendingProperty);
    closeModal('phoneWarningModal');
}

function saveWithoutPhone() {
    saveToDB(pendingProperty);
    closeModal('phoneWarningModal');
}

function saveToDB(data) {
    properties.unshift(data);
    localStorage.setItem('realEstateCRM', JSON.stringify(properties));
    renderTable();
}

function updateInlineField(id, field, newValue) {
    const index = properties.findIndex(p => p.internal_id === id);
    if (index > -1) {
        properties[index][field] = newValue.trim();
        localStorage.setItem('realEstateCRM', JSON.stringify(properties));
    }
}

function updateStatus(id, newStatus) {
    const index = properties.findIndex(p => p.internal_id === id);
    if (index > -1) {
        properties[index].status = newStatus;
        localStorage.setItem('realEstateCRM', JSON.stringify(properties));
        renderTable();
    }
}

function filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = properties.filter(prop => {
        return Object.values(prop).some(val => String(val).toLowerCase().includes(query));
    });
    renderTable(filtered);
}

// ეს ფუნქცია იძახებს პირდაპირ Gemini API-ს (Google)
async function processAI() {
    const rawText = document.getElementById('aiInput').value;
    if (!rawText) return alert("გთხოვთ შეიყვანოთ ტექსტი");

    const saveBtn = document.querySelector('.btn-save');
    saveBtn.innerText = "მუშავდება (Gemini)...";
    saveBtn.disabled = true;

    // ⚠️ ჩაწერეთ თქვენი ნამდვილი API გასაღები აქ:
    const API_KEY = "AIzaSyAkUPpT041PgtFzdSKOMOwxYppAPbZoEsM";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

    // მკაცრი ინსტრუქცია (System Prompt), რომ დააბრუნოს მხოლოდ JSON
    const systemPrompt = `
    შენ ხარ უძრავი ქონების გამოცდილი ასისტენტი. შენი მიზანია ტექსტიდან ამოიღო კონკრეტული მონაცემები და დააბრუნო მხოლოდამხოლოდ სუფთა JSON ობიექტი. არ გამოიყენო Markdown (\`\`\`json). უბრალოდ დააბრუნე ობიექტი.
    
    ფორმატი: { 
      "owner_name": "სახელი", 
      "phone": "ტელეფონი", 
      "deal_type": "იყიდება/ქირავდება/გირავდება", 
      "prop_type": "ბინა/სახლი...", 
      "location": "ლოკაცია", 
      "price": "ფასი + ვალუტა", 
      "social_permit": "კი/არა", 
      "conditions": "მოკლე პირობა", 
      "comment": "დამატებითი კომენტარი", 
      "agency_id": "ID" 
    }
    
    ტექსტი დასამუშავებლად: "${rawText}"
    `;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });

        const data = await response.json();
        
        // Gemini აბრუნებს ტექსტს კონკრეტულ ველში
        let responseText = data.candidates[0].content.parts[0].text;
        
        // ხანდახან AI მაინც ამატებს ```json-ს, ამიტომ ვასუფთავებთ
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let extractedData = JSON.parse(responseText);

        extractedData.internal_id = Date.now();
        extractedData.client_name = ""; 
        extractedData.client_phone = "";
        extractedData.status = "აქტიური"; 

        closeModal('aiModal');
        document.getElementById('aiInput').value = '';

        if (!extractedData.phone || extractedData.phone === "" || extractedData.phone === "N/A") {
            pendingProperty = extractedData;
            document.getElementById('phoneWarningModal').style.display = 'flex';
        } else {
            saveToDB(extractedData); // ეს ჯერ ისევ ლოკალურ ბაზაში ინახავს
        }

    } catch (error) {
        console.error("Gemini Error:", error);
        alert("AI-სთან კავშირი ვერ მოხერხდა. შეამოწმეთ API Key.");
    } finally {
        saveBtn.innerText = "დამუშავება";
        saveBtn.disabled = false;
    }

}
