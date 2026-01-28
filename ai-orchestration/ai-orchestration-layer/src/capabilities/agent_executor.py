# ============================================================================
# File: backend/ai-orchestration-layer/src/capabilities/agent_executor.py
# Multi-Agent System Executor - UPDATED WITH ALL NEW TOOLS
# Now includes note, cart, and room management capabilities
# Tracks capabilities used for observability metrics
# ============================================================================

from typing import Dict, Any, Optional, Literal
from langchain.agents import AgentExecutor as LangChainAgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage

from capabilities.base_capability import BaseCapability, CapabilityError
from core.state import UnifiedState
from core.tool_manager import get_tool_manager
from core.unified_logger import get_logger


AgentType = Literal["shop", "petstore", "vehicle", "none"]


class AgentExecutor(BaseCapability):
    """
    Multi-agent system executor with intelligent routing
    Uses supervisor pattern for complex queries
    NOW INCLUDES: Notes, Cart, and Room management tools
    """
    
    def __init__(self):
        super().__init__(capability_name="agent_executor")
        
        self.tool_manager = get_tool_manager()
        self.logger = get_logger()
        
        # Initialize specialized agents (using shared tools from tool manager)
        self.agents: Dict[AgentType, Optional[LangChainAgentExecutor]] = {
            "shop": self._create_shop_agent(),
            "petstore": self._create_petstore_agent(),
            "vehicle": self._create_vehicle_agent(),
            "none": None
        }
        
        # Track agent usage
        self.agent_usage: Dict[AgentType, int] = {
            "shop": 0,
            "petstore": 0,
            "vehicle": 0,
            "none": 0
        }
        
        # Log tool counts for verification
        shop_tools = self.tool_manager.get_tools_for_agent("shop")
        self.logger.info("agent_executor_initialized", {
            "shop_tools_count": len(shop_tools),
            "petstore_tools_count": len(self.tool_manager.get_tools_for_agent("petstore")),
            "vehicle_tools_count": len(self.tool_manager.get_tools_for_agent("vehicle")),
            "total_tools": len(self.tool_manager.registry.get_all_tools())
        })
    
    def _create_shop_agent(self) -> LangChainAgentExecutor:
        """
        Create shop specialist agent with ALL shopping tools
        NOW INCLUDES: CloudApp (6) + Cart (4) + Note (5) = 15 tools
        """
        # Get comprehensive shop tools (cloudapp + cart + notes)
        tools = self.tool_manager.get_tools_for_agent("shop")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a comprehensive shopping assistant for cloudapp store.

CAPABILITIES:
📦 Inventory Management:
   - Browse all items in the shop
   - Get details for specific items
   - Check item availability

🛒 Shopping Cart:
   - Add items to cart
   - Remove items from cart
   - View cart contents
   - Clear entire cart

📝 Order Management:
   - Submit orders
   - View order history
   - Track order status

✍️ Note Taking:
   - Create notes about purchases
   - Update shopping lists
   - Search through notes
   - Delete old notes

👤 User Management:
   - Look up user information
   - View user profiles

Use the available tools to complete requests efficiently. Be helpful and concise.
Always confirm actions with the user before making changes."""),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}")
        ])
        
        agent = create_tool_calling_agent(self.llm, tools, prompt)
        return LangChainAgentExecutor(agent=agent, tools=tools, verbose=False, handle_parsing_errors=True)
    
    def _create_petstore_agent(self) -> LangChainAgentExecutor:
        """
        Create petstore specialist agent
        Handles: Employee (3) + Schedule (4) = 7 tools
        """
        tools = self.tool_manager.get_tools_for_agent("petstore")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a pet care scheduling assistant.

CAPABILITIES:
👥 Employee Management:
   - View all employees
   - Get employee details
   - Check employee schedules

📅 Schedule Management:
   - View all schedules
   - Get schedule details
   - Find employee availability
   - Schedule appointments

🐾 Pet Services:
   - View available services
   - Check service information

Use the available tools to help with pet care scheduling and employee management."""),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}")
        ])
        
        agent = create_tool_calling_agent(self.llm, tools, prompt)
        return LangChainAgentExecutor(agent=agent, tools=tools, verbose=False, handle_parsing_errors=True)
    
    def _create_vehicle_agent(self) -> LangChainAgentExecutor:
        """
        Create vehicle specialist agent
        Handles: Vehicle inventory (7) tools
        """
        tools = self.tool_manager.get_tools_for_agent("vehicle")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a vehicle inventory assistant.

CAPABILITIES:
🚗 Vehicle Search:
   - Browse all vehicles
   - Search by make (Toyota, Honda, etc.)
   - Search by model (Civic, Camry, etc.)
   - Search by year
   - Search by price range
   - Filter available vehicles only

📍 Vehicle Information:
   - Get detailed vehicle specs
   - Check availability
   - View pricing

CRITICAL INSTRUCTIONS:
1. When the user asks for vehicles, use the appropriate tool to fetch the data.
2. The tool will return a list of vehicles in JSON format.
3. You MUST read this JSON data and summarize it for the user in natural language.
4. Do NOT simply confirm the action was taken. You must describe the vehicles found (e.g., "I found a 2024 Chevrolet sedan...").
5. If the list is empty, clearly state "I couldn't find any vehicles matching your criteria."
"""),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}")
        ])
        
        agent = create_tool_calling_agent(self.llm, tools, prompt)
        return LangChainAgentExecutor(agent=agent, tools=tools, verbose=False, handle_parsing_errors=True)
    
    async def _execute_internal(self, state: UnifiedState) -> Dict[str, Any]:
        """
        Internal execution logic - uses supervisor for routing
        
        Args:
            state: Current unified state
        
        Returns:
            Agent execution results
        """
        # Track Agent Execution capability usage
        if "capabilities_used" not in state:
            state["capabilities_used"] = []
        state["capabilities_used"].append("Agent Execution")
        
        query: str = state["input_data"]
        
        # Use supervisor to determine best agent
        agent_type: AgentType = await self._supervisor_route(query, state)
        
        self.logger.info("agent_routing_decision", {
            "query": query[:100],
            "selected_agent": agent_type,
            "query_keywords": self._extract_keywords(query)
        })
        
        # Track usage
        self.agent_usage[agent_type] += 1
        
        # Execute with selected agent
        if agent_type == "none":
            return self._handle_no_agent_match(query)
        
        agent = self.agents[agent_type]
        if not agent:
            raise CapabilityError(
                message=f"Agent '{agent_type}' not initialized",
                capability_name=self.capability_name,
                error_code=f"AGENT_{agent_type.upper()}_NOT_FOUND",
                recoverable=False
            )
        
        try:
            # Track Tool Invocation capability
            state["capabilities_used"].append("Tool Invocation")
            
            # Execute agent (async invoke)
            result = await agent.ainvoke({"input": query})
            
            output: str = result.get("output", "No result from agent")
            
            self.logger.log_tool_call(
                tool_name=f"{agent_type}_agent",
                args={"query": query},
                result=output
            )
            
            return {
                "agent_used": agent_type,
                "result": output,
                "intermediate_steps": result.get("intermediate_steps", []),
                "routing": "success",
                "confidence": self._calculate_routing_confidence(query, agent_type)
            }
            
        except Exception as e:
            self.logger.error("agent_execution_failed", {
                "agent": agent_type,
                "query": query
            }, error=e)
            
            raise CapabilityError(
                message=f"Agent '{agent_type}' execution failed: {str(e)}",
                capability_name=self.capability_name,
                error_code=f"AGENT_{agent_type.upper()}_EXECUTION_ERROR",
                recoverable=True,
                original_error=e
            )
    
    async def _supervisor_route(
        self,
        query: str,
        state: UnifiedState
    ) -> AgentType:
        """
        Supervisor agent decides which specialist to use
        NOW INCLUDES: note, cart, and room keyword detection
        
        Args:
            query: User query
            state: Current state
        
        Returns:
            Selected agent type
        """
        query_lower = query.lower()
        
        # Fast path: Clear keyword matches
        # Shop agent handles: shopping, cart, orders, items, notes
        shop_keywords = [
            # Shopping
            "shop", "store", "buy", "purchase", "item", "product", "inventory",
            # Cart
            "cart", "basket", "add to cart", "remove from cart",
            # Orders
            "order", "checkout", "submit order", "order history",
            # Notes
            "note", "write", "create note", "save note", "note about", "shopping list",
            # User
            "user", "account", "profile"
        ]
        
        if any(word in query_lower for word in shop_keywords):
            return "shop"
        
        # Petstore agent keywords
        petstore_keywords = [
            "pet", "groom", "grooming", "schedule", "appointment", 
            "vet", "veterinary", "animal", "employee", "staff"
        ]
        
        if any(word in query_lower for word in petstore_keywords):
            return "petstore"
        
        # Vehicle agent keywords
        vehicle_keywords = [
            "car", "vehicle", "auto", "truck", "suv", "sedan",
            "toyota", "honda", "ford", "chevrolet", "bmw", "mercedes",
            "price", "mileage", "year", "model", "make"
        ]
        
        if any(word in query_lower for word in vehicle_keywords):
            return "vehicle"
        
        # Ambiguous query - use LLM supervisor
        try:
            agent_type = await self._llm_supervisor_decision(query)
            return agent_type
        except Exception as e:
            self.logger.warning("supervisor_llm_failed", {
                "error": str(e),
                "fallback": "none"
            })
            return "none"

    async def _llm_supervisor_decision(self, query: str) -> AgentType:
        """
        Use LLM to make routing decision for ambiguous queries
        UPDATED with new capabilities

        Args:
            query: User query

        Returns:
            Agent type decision
        """
        supervisor_prompt = f"""You are a routing supervisor for a multi-agent system.

Available agents:
- shop: Handles shopping, inventory, carts (add/remove/view), orders, notes, user accounts
- petstore: Handles pet care, grooming, appointments, employee schedules, veterinary services
- vehicle: Handles vehicle inventory, search by make/model/year/price, availability

Analyze this query and respond with ONLY the agent name (shop/petstore/vehicle/none):

Query: {query}

Agent:"""

        messages = [
            SystemMessage(content="You are a routing supervisor. Respond with only: shop, petstore, vehicle, or none"),
            HumanMessage(content=supervisor_prompt)
        ]

        response = await self.llm.ainvoke(messages)
        decision = response.content.strip().lower()

        # Validate decision
        valid_agents: set[str] = {"shop", "petstore", "vehicle", "none"}
        if decision in valid_agents:
            return decision  # type: ignore

        return "none"
    
    def _handle_no_agent_match(self, query: str) -> Dict[str, Any]:
        """
        Handle queries that don't match any agent
        UPDATED with new capabilities

        Args:
            query: User query

        Returns:
            Helpful response
        """
        return {
            "agent_used": "none",
            "result": """I can help you with:

🛒 Shopping (cloudapp store):
   - Browse items and manage your cart
   - Place orders and track history
   - Create shopping notes and lists

🐾 Pet Care:
   - Schedule grooming appointments
   - Check employee availability
   - Manage pet services

🚗 Vehicles:
   - Search vehicle inventory
   - Filter by make, model, year, or price
   - Check availability

What would you like to do?""",
            "routing": "no_match",
            "confidence": 0.0,
            "suggestions": [
                "Add items to my cart and create a note",
                "Schedule a pet grooming appointment",
                "Find Toyota vehicles under $30,000"
            ]
        }
    
    def _extract_keywords(self, query: str) -> list:
        """Extract keywords from query for logging"""
        words = query.lower().split()
        keywords = [w for w in words if len(w) > 3]
        return keywords[:5]
    
    def _calculate_routing_confidence(self, query: str, agent_type: AgentType) -> float:
        """Calculate confidence score for routing decision"""
        query_lower = query.lower()
        
        confidence_map = {
            "shop": ["shop", "buy", "cart", "order", "item", "note"],
            "petstore": ["pet", "groom", "schedule", "appointment"],
            "vehicle": ["car", "vehicle", "auto", "price"]
        }
        
        if agent_type == "none":
            return 0.0
        
        keywords = confidence_map.get(agent_type, [])
        matches = sum(1 for keyword in keywords if keyword in query_lower)
        
        return min(matches / len(keywords), 1.0) if keywords else 0.5
    
    async def _execute_fallback(self, state: UnifiedState) -> Dict[str, Any]:
        """
        Fallback when agent execution fails
        
        Args:
            state: Current state
        
        Returns:
            Fallback response
        """
        return {
            "agent_used": "fallback",
            "result": "I'm having trouble processing that request right now. Please try rephrasing or try again later.",
            "routing": "fallback",
            "confidence": 0.0
        }
    
    def get_agent_stats(self) -> Dict[str, Any]:
        """
        Get agent usage statistics
        
        Returns:
            Statistics dictionary
        """
        total_uses = sum(self.agent_usage.values())
        
        # Get tool counts per agent
        tool_counts = {
            "shop": len(self.tool_manager.get_tools_for_agent("shop")),
            "petstore": len(self.tool_manager.get_tools_for_agent("petstore")),
            "vehicle": len(self.tool_manager.get_tools_for_agent("vehicle")),
            "total": len(self.tool_manager.all_tools)
        }
        
        return {
            "total_executions": total_uses,
            "agent_usage": self.agent_usage.copy(),
            "agent_distribution": {
                agent: (count / total_uses * 100 if total_uses > 0 else 0)
                for agent, count in self.agent_usage.items()
            },
            "tool_counts": tool_counts,
            **self.get_metrics()
        }
