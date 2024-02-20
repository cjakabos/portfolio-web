import React, { useState } from 'react'
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

const Input = ({ onSendMessage }) => {
    const [text, setText] = useState("")

    let onChange = (e) => {
        setText(e.target.value)
    }

    let onSubmit = () => {
        setText("")
        onSendMessage(text);
    }

    return (
        <div className="message-input">
            <TextField
                className="inputField"
                label="Type your message here..."
                placeholder="Enter your message and press ENTER"
                onChange={e => onChange(e)}
                margin="normal"
                value={text}
                onKeyPress={event => {
                    if (event.key === 'Enter') {
                        onSubmit(text);
                    }
                }}
                style={{ height: "30px", width: "80%", marginRight: '10px' }}
            />

            <Button
                variant="contained"
                color="primary"
                onClick={onSubmit}
                style={{ marginTop: '15px', padding: '16px' }}>
                Send
            </Button>
        </div>
    );
}


export default Input
