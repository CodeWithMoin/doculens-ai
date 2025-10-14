from typing import Any, List

from docling_core.transforms.chunker.tokenizer.base import BaseTokenizer
from pydantic import ConfigDict
from tiktoken import get_encoding


class OpenAITokenizerWrapper(BaseTokenizer):
    """Wrapper to make OpenAI's tiktoken tokenizer compatible with Docling's HybridChunker."""

    model_config = ConfigDict(arbitrary_types_allowed=True, extra="allow")

    model_name: str
    max_length: int
    tokenizer: Any

    def __init__(self, model_name: str = "cl100k_base", max_length: int = 8191):
        """
        Args:
            model_name: The name of the tiktoken encoding to use (e.g. 'cl100k_base')
            max_length: Maximum number of tokens the model can handle
        """
        object.__setattr__(self, "model_name", model_name)
        object.__setattr__(self, "max_length", max_length)
        object.__setattr__(self, "tokenizer", get_encoding(model_name))

    # --- Required abstract methods for BaseTokenizer ---
    def get_tokenizer(self):
        """Return the underlying tokenizer object."""
        return self.tokenizer

    def get_max_tokens(self) -> int:
        """Return the tokenizer's maximum sequence length."""
        return self.max_length

    # --- Typical tokenizer methods used by HybridChunker ---
    def tokenize(self, text: str) -> List[str]:
        """Tokenize text into token strings."""
        return [str(t) for t in self.tokenizer.encode(text)]

    def count_tokens(self, text: str) -> int:
        """Count the number of tokens in a string."""
        return len(self.tokenizer.encode(text))

    def detokenize(self, tokens: List[str]) -> str:
        """Reconstruct text from token IDs."""
        return self.tokenizer.decode([int(t) for t in tokens])

    # --- Optional helper methods ---
    def vocab_size(self) -> int:
        return self.tokenizer.max_token_value
