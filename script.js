// ლოკალური მეხსიერების ინიციალიზაცია
let properties = JSON.parse(localStorage.getItem('realEstateDB')) || [];

document.addEventListener('DOMContentLoaded', () => {
    global_renderTable();
    // ტელეგრამის WebApp-ისთვის
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
    }
});

function global_openModal() { document.getElementById('aiModal').style.display = 'flex'; }
function global_closeModal() { document.getElementById('aiModal').style.display = 'none'; }

// ფუნქცია რომელიც მომავალში AI-ს მიებმება
function global_processManualEntry() {
    const text = document.getElementById('aiInput').value;
    if (!text) return;

    // დროებითი "ხელით" დამუშავება AI-მდე
    // აქ მოხდება თქვენი სცენარის მიხედვით მონაცემების შევსება
    const newEntry = {
        internal_id: Date.now(),
        owner_name: "ლუკა",
        phone: "555555555",
        link: "https://...",
        deal_type: "ქირავდება",
        prop_type: "ბინა",
        location: "აბაშიძის ქუჩა N20",
        price: "1200$",
        social_permit: "კი",
        conditions: "შეზღუდვა ცხოველებზე",
        comment: "დააკლებს 50$-ს",
        agency_id: "123456",
        client_name: "", // ხელით შესაყვანი
        client_phone: "", // ხელით შესაყვანი
        status: "აქტიური" // default
    };

    properties.unshift(newEntry);
    global_saveAndRefresh();
    global_closeModal();
    document.getElementById('aiInput').value = "";
}

function global_saveAndRefresh() {
    localStorage.setItem('realEstateDB', JSON.stringify(properties));
    global_renderTable();
}

function global_renderTable(data = properties) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    data.forEach(prop => {
        const tr = document.createElement('tr');
        tr.className = global_getRowStatusClass(prop.status);
        
        tr.innerHTML = `
            <td data-label="მესაკუთრე">${prop.owner_name}</td>
            <td data-label="ტელეფონი">${prop.phone}</td>
            <td data-label="Link"><a href="${prop.link}" target="_blank" style="color:var(--accent)">ბმული</a></td>
            <td data-label="გარიგება">${prop.deal_type}</td>
            <td data-label="ტიპი">${prop.prop_type}</td>
            <td data-label="ლოკაცია & ფასი">${prop.location} - ${prop.price}</td>
            <td data-label="სოც. ნებართვა">${prop.social_permit}</td>
            <td data-label="პირობები">${prop.conditions}</td>
            <td data-label="კომენტარი">${prop.comment}</td>
            <td data-label="Agency ID">${prop.agency_id}</td>
            <td data-label="კლიენტის სახ" contenteditable="true" onblur="global_updateInlineField(${prop.internal_id}, 'client_name', this.innerText)">${prop.client_name}</td>
            <td data-label="კლიენტის ტელ" contenteditable="true" onblur="global_updateInlineField(${prop.internal_id}, 'client_phone', this.innerText)">${prop.client_phone}</td>
            <td data-label="შედეგი">
                <select class="status-select" onchange="global_updateStatus(${prop.internal_id}, this.value)">
                    <option value="აქტიური" ${prop.status === 'აქტიური' ? 'selected' : ''}>აქტიური</option>
                    <option value="ჩანიშნულია" ${prop.status === 'ჩანიშნულია' ? 'selected' : ''}>ჩანიშნულია</option>
                    <option value="გაქირავდა ჩვენით" ${prop.status === 'გაქირავდა ჩვენით' ? 'selected' : ''}>გაქირავდა (ჩვენით)</option>
                    <option value="გაქირავდა სხვით" ${prop.status === 'გაქირავდა სხვით' ? 'selected' : ''}>გაქირავდა (სხვით)</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function global_getRowStatusClass(status) {
    switch(status) {
        case 'აქტიური': return 'status-active';
        case 'ჩანიშნულია': return 'status-meeting';
        case 'გაქირავდა ჩვენით': return 'status-success';
        case 'გაქირავდა სხვით': return 'status-failed';
        default: return '';
    }
}

function global_updateStatus(id, newStatus) {
    const index = properties.findIndex(p => p.internal_id === id);
    if (index !== -1) {
        properties[index].status = newStatus;
        global_saveAndRefresh();
    }
}

function global_updateInlineField(id, field, value) {
    const index = properties.findIndex(p => p.internal_id === id);
    if (index !== -1) {
        properties[index][field] = value;
        localStorage.setItem('realEstateDB', JSON.stringify(properties));
    }
}

function global_filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = properties.filter(p => {
        return p.agency_id.includes(query) || 
               p.phone.includes(query) || 
               p.owner_name.toLowerCase().includes(query) ||
               p.location.toLowerCase().includes(query);
    });
    global_renderTable(filtered);
}
